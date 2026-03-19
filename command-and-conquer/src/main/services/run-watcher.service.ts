import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Notification, BrowserWindow } from 'electron';
import { RunImporterService } from './run-importer.service';
import { TaskService } from './task.service';
import { FileStore } from '../storage/file-store';

/**
 * Normalize a filesystem path to use forward slashes consistently and
 * resolve to an absolute path. Windows configs store paths with mixed
 * separators (C:\foo\bar and c:/foo/bar) which breaks chokidar matching.
 */
function normalizePath(p: string): string {
  return path.resolve(p).replace(/\\/g, '/');
}

/**
 * Watches the hub runs folder (and internal workspace as fallback) for AI-written artifacts.
 * Hub layout: {hubPath}/runs/{projectId}/{runId}/
 * When a complete run appears (all 5 files, no run.meta.json), auto-imports it,
 * fires a native OS notification, and pushes an IPC event to the renderer.
 */
export class RunWatcherService {
  private watcher: chokidar.FSWatcher | null = null;
  private processing = new Set<string>(); // debounce: track folders being processed
  // Folders where we've seen job_result.json but not all 5 files yet — we poll these
  private pendingPolls = new Map<string, ReturnType<typeof setInterval>>();
  private internalBasePath: string;
  // Normalized hub runs root (e.g. /abs/path/.c2/runs), or null if not configured
  private hubRunsPath: string | null = null;

  constructor(
    private fileStore: FileStore,
    private runImporterService: RunImporterService,
    private taskService: TaskService,
  ) {
    this.internalBasePath = normalizePath(fileStore.resolvePath('workspace/projects'));
  }

  async start(): Promise<void> {
    if (this.watcher) return;

    // Resolve hub path once at startup
    const rawHub = await this.runImporterService.getHubRunsPath();
    this.hubRunsPath = rawHub ? normalizePath(rawHub) : null;

    const patterns: string[] = [];

    if (this.hubRunsPath) {
      // Hub mode: ONE pattern covers ALL projects — {hubPath}/runs/{projectId}/{runId}/job_result.json
      await fs.mkdir(this.hubRunsPath, { recursive: true }).catch(() => {});
      patterns.push(this.hubRunsPath + '/*/*/job_result.json');
      console.log('[RunWatcher] Hub mode — watching:', this.hubRunsPath + '/*/*/job_result.json');
    } else {
      // Legacy fallback: internal workspace per-project paths
      patterns.push(normalizePath(path.join(this.internalBasePath, '*/runs/*/job_result.json')));
      console.log('[RunWatcher] Legacy mode — watching internal workspace');
    }

    this.watcher = chokidar.watch(patterns, {
      ignoreInitial: true,   // live watcher ignores existing — startup scan handles those
      awaitWriteFinish: {    // wait until the file is fully written before firing
        stabilityThreshold: 1500,
        pollInterval: 200,
      },
      persistent: true,
    });

    this.watcher.on('add', (filePath) => {
      console.log('[RunWatcher] Detected file:', filePath);
      this.handleNewArtifact(filePath).catch((err) => {
        console.error('[RunWatcher] handleNewArtifact error:', err);
      });
    });
  }

  /**
   * Called once after the renderer window has finished loading.
   * Scans all projects for runs written while the app was closed and imports them.
   */
  async scanOnStartup(): Promise<void> {
    // Ensure hub path is resolved
    if (!this.hubRunsPath) {
      const rawHub = await this.runImporterService.getHubRunsPath().catch(() => null);
      this.hubRunsPath = rawHub ? normalizePath(rawHub) : null;
    }

    try {
      // Collect project IDs to scan
      let projectIds: string[] = [];

      if (this.hubRunsPath) {
        // Hub mode: enumerate project subdirectories under {hubPath}/runs/
        const hubNative = this.hubRunsPath.replace(/\//g, path.sep);
        await fs.mkdir(hubNative, { recursive: true }).catch(() => {});
        const entries = await fs.readdir(hubNative, { withFileTypes: true }).catch(() => []);
        projectIds = entries.filter(e => e.isDirectory()).map(e => e.name);
      } else {
        // Legacy: enumerate from internal workspace
        const internalNative = this.internalBasePath.replace(/\//g, path.sep);
        const entries = await fs.readdir(internalNative).catch(() => [] as string[]);
        projectIds = entries;
      }

      for (const projectId of projectIds) {
        try {
          const pending = await this.runImporterService.scanPendingRuns(projectId);
          for (const p of pending) {
            if (p.hasAllArtifacts && p.taskId) {
              await this.handleNewArtifact(path.join(p.folderPath, 'job_result.json'));
            } else if (p.hasAllArtifacts) {
              this.pushToRenderer({ type: 'needs-manual', projectId, runId: p.runId });
            }
          }
        } catch { /* skip this project, non-fatal */ }
      }
    } catch { /* non-fatal */ }
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    // Cancel all pending polls
    for (const [, timer] of this.pendingPolls) clearInterval(timer);
    this.pendingPolls.clear();
  }

  /**
   * Start polling a run folder every 3 seconds until all 5 artifacts appear
   * or 90 seconds elapses. Handles agents that write files one-by-one.
   */
  private startPollingForCompletion(runFolder: string, normalFolder: string): void {
    if (this.pendingPolls.has(normalFolder)) return; // already polling

    const required = ['job_result.json', 'changed_files.json', 'review_checklist.json', 'job_summary.md', 'code_snippets.md'];
    const startedAt = Date.now();
    const TIMEOUT_MS = 300_000; // give up after 5 minutes
    const INTERVAL_MS = 3_000;

    const timer = setInterval(async () => {
      try {
        const files: string[] = await fs.readdir(runFolder).catch(() => []);
        const hasAll = required.every(f => files.includes(f));
        console.log(`[RunWatcher] Poll ${runFolder}: ${files.filter(f => required.includes(f)).length}/5 artifacts`);

        if (hasAll) {
          this.stopPolling(normalFolder);
          // Release the processing lock so handleNewArtifact can run again
          this.processing.delete(normalFolder);
          await this.handleNewArtifact(path.join(runFolder, 'job_result.json'));
        } else if (Date.now() - startedAt > TIMEOUT_MS) {
          console.warn('[RunWatcher] Timed out waiting for all artifacts in', runFolder);
          this.stopPolling(normalFolder);
          this.processing.delete(normalFolder);
          // Surface to renderer so user can manually import
          const location = this.resolveRunLocation(runFolder);
          if (location) {
            this.pushToRenderer({ type: 'needs-manual', projectId: location.projectId, runId: location.runId });
          }
        }
      } catch (err) {
        console.error('[RunWatcher] Poll error for', runFolder, err);
      }
    }, INTERVAL_MS);

    this.pendingPolls.set(normalFolder, timer);
  }

  private stopPolling(normalFolder: string): void {
    const timer = this.pendingPolls.get(normalFolder);
    if (timer) {
      clearInterval(timer);
      this.pendingPolls.delete(normalFolder);
    }
  }

  /**
   * Given a run folder path, determine the projectId, runId, and absolute folder path.
   *
   * Hub layout:      {hubPath}/runs/{projectId}/{runId}/
   * Internal layout: {workspace}/projects/{projectId}/runs/{runId}/
   */
  private resolveRunLocation(runFolder: string): { projectId: string; runId: string; absoluteFolderPath?: string } | null {
    const normalFolder = normalizePath(runFolder);

    // Hub mode: {hubRunsPath}/{projectId}/{runId}/
    if (this.hubRunsPath && normalFolder.startsWith(this.hubRunsPath + '/')) {
      const rel = normalFolder.slice(this.hubRunsPath.length + 1); // "{projectId}/{runId}"
      const parts = rel.split('/');
      const projectId = parts[0];
      const runId = parts[1];
      if (projectId && runId) {
        return { projectId, runId, absoluteFolderPath: runFolder };
      }
    }

    // Legacy internal path:  .../workspace/projects/{projectId}/runs/{runId}/
    const parts = normalFolder.split('/');
    const runsIdx = parts.lastIndexOf('runs');
    if (runsIdx < 2) return null;
    const runId = parts[runsIdx + 1];
    const projectId = parts[runsIdx - 1];
    if (!runId || !projectId) return null;
    return { projectId, runId };
  }

  private async handleNewArtifact(jobResultPath: string): Promise<void> {
    const runFolder = path.dirname(jobResultPath);
    const normalFolder = normalizePath(runFolder);
    if (this.processing.has(normalFolder)) return;
    this.processing.add(normalFolder);

    try {
      // If run.meta.json exists and is not a placeholder, the run is already imported.
      const metaPath = path.join(runFolder, 'run.meta.json');
      const alreadyImported = await fs.access(metaPath).then(() => true).catch(() => false);
      if (alreadyImported) {
        try {
          const existing = JSON.parse(await fs.readFile(metaPath, 'utf8')) as { status?: string };
          if (existing.status && existing.status !== 'importing') return;
        } catch {
          return;
        }
      }

      // Resolve project / run identity from path
      const location = this.resolveRunLocation(runFolder);
      if (!location) {
        console.warn('[RunWatcher] Could not resolve project/run from path:', runFolder);
        return;
      }
      const { projectId, runId, absoluteFolderPath } = location;
      console.log(`[RunWatcher] Resolved: projectId=${projectId}, runId=${runId}, external=${!!absoluteFolderPath}`);

      // Validate that all 5 required artifacts are present.
      // AI agents often write files sequentially — job_result.json may appear first.
      // If not all files are here yet, start polling every 3 seconds for up to 90 seconds.
      const required = ['job_result.json', 'changed_files.json', 'review_checklist.json', 'job_summary.md', 'code_snippets.md'];
      const files: string[] = await fs.readdir(runFolder).catch(() => []);
      const hasAll = required.every(f => files.includes(f));
      if (!hasAll) {
        console.log('[RunWatcher] Incomplete artifacts in', runFolder, '— starting poll for remaining files');
        this.startPollingForCompletion(runFolder, normalFolder);
        return; // handleNewArtifact will be called again by the poller when ready
      }
      // Made it here — cancel any outstanding poll for this folder
      this.stopPolling(normalFolder);

      // Read task_id from job_result so we can link automatically
      let taskId: string | undefined;
      try {
        const jr = JSON.parse(await fs.readFile(jobResultPath, 'utf8'));
        if (jr.task_id) taskId = jr.task_id;
      } catch { /* ignore */ }

      if (!taskId) {
        this.pushToRenderer({ type: 'needs-manual', projectId, runId });
        return;
      }

      // Auto-import — pass absoluteFolderPath for external runs
      const { run } = await this.runImporterService.importRunById(projectId, runId, taskId, absoluteFolderPath);
      console.log(`[RunWatcher] Auto-imported run ${run.id} for task ${taskId}`);

      // Resolve task title for the notification
      let taskTitle = taskId;
      try {
        const task = await this.taskService.getTask(projectId, taskId);
        if (task?.title) taskTitle = task.title;
      } catch { /* ignore */ }

      // Fire native OS notification
      if (Notification.isSupported()) {
        const notif = new Notification({
          title: '✓ Run Complete — Ready for Review',
          body: `${run.id}  ·  ${taskTitle}`,
          silent: false,
        });
        notif.on('click', () => {
          this.focusWindow();
          this.pushToRenderer({ type: 'navigate-review', projectId, taskId, runId: run.id });
        });
        notif.show();
      }

      // Always push to renderer regardless of notification support
      this.pushToRenderer({ type: 'auto-imported', projectId, taskId, runId: run.id, taskTitle, summary: run.summary });
    } catch (err) {
      console.error('[RunWatcher] Import error for', runFolder, err);
      this.pushToRenderer({ type: 'import-error', runFolder, error: (err as Error).message });
    } finally {
      // Allow re-processing this folder after a delay (handles write retries)
      setTimeout(() => this.processing.delete(normalFolder), 10_000);
    }
  }

  private pushToRenderer(payload: Record<string, unknown>): void {
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      win.webContents.send('run:auto-imported', payload);
    }
  }

  private focusWindow(): void {
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  }
}
