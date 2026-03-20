import { FileStore } from '../storage/file-store';
import { SchemaValidator } from '../storage/schema-validator';
import { KnowledgeService } from './knowledge.service';
import { TaskService } from './task.service';
import { Run, JobResult, ImportedChangedFile, ImportedReviewChecklist, RunChangedFile, RunTimelineEntry } from '../types';
import * as path from 'path';
import * as fs from 'fs/promises';

/** Strip UTF-8 BOM (\uFEFF) that AI coding agents frequently prepend to JSON files. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

export class RunImporterService {
  private fileStore: FileStore;
  private schemaValidator: SchemaValidator;
  private knowledgeService: KnowledgeService;
  private taskService: TaskService;

  constructor(fileStore: FileStore, schemaValidator: SchemaValidator, knowledgeService: KnowledgeService, taskService: TaskService) {
    this.fileStore = fileStore;
    this.schemaValidator = schemaValidator;
    this.knowledgeService = knowledgeService;
    this.taskService = taskService;
  }

  /**
   * Read the global hub path from settings.
   * Returns the hubPath string, or null if not configured.
   * The hub is a single folder (e.g. C:\Users\G\Documents\Command\.c2) that
   * holds runs from ALL projects: {hubPath}/runs/{projectId}/{runId}/
   */
  private async getHubPath(): Promise<string | null> {
    try {
      const settings = await this.fileStore.readJSON<{ hubPath?: string }>('system/settings.json');
      if (settings?.hubPath && settings.hubPath.trim()) {
        return settings.hubPath.trim();
      }
    } catch { /* no settings yet */ }
    return null;
  }

  /**
   * Returns the absolute path to the runs folder for a project.
   * With hub configured:  {hubPath}/runs/{projectId}
   * Without hub:          internal workspace fallback (legacy)
   */
  async getRunsBasePath(projectId: string): Promise<string> {
    const hubPath = await this.getHubPath();
    if (hubPath) {
      return path.join(hubPath, 'runs', projectId);
    }
    return this.fileStore.resolvePath(`workspace/projects/${projectId}/runs`);
  }

  /**
   * Returns the hub base path for the watcher — just the hub root, not per-project.
   * The watcher watches {hubPath}/runs/ and parses projectId from the path.
   * Returns null if hub is not configured (fall back to internal watch).
   */
  async getHubRunsPath(): Promise<string | null> {
    const hubPath = await this.getHubPath();
    if (hubPath) {
      return path.join(hubPath, 'runs');
    }
    return null;
  }

  /**
   * Get all project IDs with their runs base paths — used by the watcher.
   * With hub configured, there is only ONE entry (the hub runs root).
   * Without hub, enumerate per-project paths (legacy behavior).
   */
  async getAllProjectRunsPaths(): Promise<Array<{ projectId: string; runsPath: string; isExternal: boolean }>> {
    const hubPath = await this.getHubPath();
    if (hubPath) {
      // Hub mode: single entry — watcher resolves projectId from path structure
      // {hubPath}/runs/{projectId}/{runId}/
      const hubRunsPath = path.join(hubPath, 'runs');
      return [{ projectId: '__hub__', runsPath: hubRunsPath, isExternal: true }];
    }

    // Legacy: per-project scan
    const result: Array<{ projectId: string; runsPath: string; isExternal: boolean }> = [];
    try {
      const projectsBase = this.fileStore.resolvePath('workspace/projects');
      const entries = await fs.readdir(projectsBase, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        result.push({
          projectId: entry.name,
          runsPath: this.fileStore.resolvePath(`workspace/projects/${entry.name}/runs`),
          isExternal: false,
        });
      }
    } catch { /* return empty */ }
    return result;
  }

  /**
   * Append an entry to a run's timeline, regardless of where the run folder lives.
   */
  async appendToTimeline(
    projectId: string,
    runId: string,
    entry: Omit<RunTimelineEntry, 'id' | 'timestamp'>
  ): Promise<void> {
    try {
      const runsBase = await this.getRunsBasePath(projectId);
      const metaPath = path.join(runsBase, runId, 'run.meta.json');
      const raw = await fs.readFile(metaPath, 'utf8').catch(() => null);
      if (!raw) return;
      const run = JSON.parse(raw) as Run;
      const newEntry: RunTimelineEntry = {
        ...entry,
        id: String(Date.now()),
        timestamp: new Date().toISOString(),
      };
      run.timeline = [...(run.timeline || []), newEntry];

      // Mirror task status changes directly onto the run's status field
      if (newEntry.type === 'status_changed' && newEntry.metadata?.status) {
        const mappedStatus: Record<string, Run['status']> = {
          approved: 'approved',
          blocked: 'rejected',
          active: 'review',
        };
        const updatedStatus = mappedStatus[newEntry.metadata.status as string];
        if (updatedStatus) {
          run.status = updatedStatus;
        }
      }

      await fs.writeFile(metaPath, JSON.stringify(run, null, 2), 'utf8');
    } catch { /* non-fatal */ }
  }

  /**
   * Delete a run and its artifacts from the filesystem.
   */
  async deleteRun(projectId: string, runId: string): Promise<void> {
    const runsBase = await this.getRunsBasePath(projectId);
    const runFolder = path.join(runsBase, runId);
    await fs.rm(runFolder, { recursive: true, force: true }).catch(() => {});
    
    // Fallback: also try removing from internal path if different
    const internalBase = this.fileStore.resolvePath(`workspace/projects/${projectId}/runs`);
    const internalFolder = path.join(internalBase, runId);
    if (internalBase !== runsBase) {
      await fs.rm(internalFolder, { recursive: true, force: true }).catch(() => {});
    }
  }

  // ─── Schema Normalizers ────────────────────────────────────────────────────
  // Coding agents frequently output subtly wrong values. These normalizers patch
  // the most common deviations so schema validation doesn't silently reject runs.

  private normalizeJobResult(jr: Record<string, unknown>, taskIdHint?: string): Record<string, unknown> {
    // status: "complete" | "done" → "success"
    const statusMap: Record<string, string> = { complete: 'success', done: 'success', completed: 'success' };
    if (typeof jr.status === 'string' && statusMap[jr.status]) jr.status = statusMap[jr.status];
    if (!jr.status) jr.status = 'success'; // Default if missing entirely

    // task_id: inject if missing
    if (!jr.task_id && taskIdHint) jr.task_id = taskIdHint;

    // task_title: ensure present
    if (!jr.task_title) jr.task_title = '';

    // summary: fallback to message or default text if omitted
    if (!jr.summary && typeof jr.message === 'string') jr.summary = jr.message;
    if (!jr.summary && typeof jr.error_message === 'string') jr.summary = jr.error_message;
    if (!jr.summary) jr.summary = 'No summary provided by agent.';

    // tool & model defaults
    if (!jr.tool) jr.tool = 'unknown';
    if (!jr.model) jr.model = 'unknown';

    // date and hash defaults
    if (!jr.created_at) jr.created_at = new Date().toISOString();
    if (!jr.commit_hash) jr.commit_hash = 'none';

    // manual_validation result: uppercase → lowercase
    if (Array.isArray(jr.manual_validation)) {
      for (const v of jr.manual_validation as Array<Record<string, unknown>>) {
        if (typeof v.result === 'string') v.result = v.result.toLowerCase();
      }
    }

    // Ensure required array fields exist
    if (!Array.isArray(jr.risks)) jr.risks = [];
    if (!Array.isArray(jr.manual_validation)) jr.manual_validation = [];

    return jr;
  }

  private normalizeChangedFiles(cf: unknown): unknown[] {
    const files: Array<Record<string, unknown>> = Array.isArray(cf) ? cf : [];
    for (const f of files) {
      // camelCase → snake_case
      if (!f.change_type && f.changeType) { f.change_type = f.changeType; delete f.changeType; }
      if (!f.risk_level && f.riskLevel) { f.risk_level = f.riskLevel; delete f.riskLevel; }
    }
    return files;
  }

  private normalizeReviewChecklist(rc: Record<string, unknown>): Record<string, unknown> {
    // Old format: { items: [...] } → new format: { checks_run: [...], checks_skipped: [], unresolved_items: [] }
    if (Array.isArray(rc.items) && !rc.checks_run) {
      rc.checks_run = rc.items;
      delete rc.items;
    }
    if (!Array.isArray(rc.checks_run)) rc.checks_run = [];
    if (!Array.isArray(rc.checks_skipped)) rc.checks_skipped = [];
    if (!Array.isArray(rc.unresolved_items)) rc.unresolved_items = [];
    return rc;
  }

  private async getSummaryFallback(fullPath: string, currentSummary: string): Promise<string> {
    if (currentSummary && currentSummary !== 'No summary provided by agent.' && currentSummary.trim() !== '') {
      return currentSummary;
    }
    try {
      const content = await fs.readFile(path.join(fullPath, 'job_summary.md'), 'utf8');
      const lines = content.split('\n');
      for (const raw of lines) {
        const line = raw.trim();
        if (line && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*') && !line.startsWith('<')) {
          // If it's a very long paragraph, cap it
          return line.length > 300 ? line.substring(0, 300) + '...' : line;
        }
      }
    } catch { /* missing or unreadable */ }
    return currentSummary;
  }

  async importRun(projectId: string, sourceFolderPath: string, taskIdOverride?: string): Promise<{ run: Run; staleDocIds: string[] }> {
    const jobResultPath = path.join(sourceFolderPath, 'job_result.json');
    const changedFilesPath = path.join(sourceFolderPath, 'changed_files.json');
    const reviewChecklistPath = path.join(sourceFolderPath, 'review_checklist.json');

    const jobResultData = await fs.readFile(jobResultPath, 'utf8');
    const changedFilesData = await fs.readFile(changedFilesPath, 'utf8');
    const reviewChecklistData = await fs.readFile(reviewChecklistPath, 'utf8');

    const jobResult = JSON.parse(jobResultData) as JobResult;
    const changedFilesInfo = JSON.parse(changedFilesData) as ImportedChangedFile[];
    const reviewChecklist = JSON.parse(reviewChecklistData) as ImportedReviewChecklist;

    const jobResultValid = await this.schemaValidator.validate('job_result', jobResult);
    if (!jobResultValid.valid) throw new Error(`job_result validation failed: ${jobResultValid.errors.join(', ')}`);

    const changedFilesValid = await this.schemaValidator.validate('changed_files', changedFilesInfo);
    if (!changedFilesValid.valid) throw new Error(`changed_files validation failed: ${changedFilesValid.errors.join(', ')}`);

    const reviewChecklistValid = await this.schemaValidator.validate('review_checklist', reviewChecklist);
    if (!reviewChecklistValid.valid) throw new Error(`review_checklist validation failed: ${reviewChecklistValid.errors.join(', ')}`);

    const runId = 'RUN-' + String(Date.now()).slice(-6);
    const destFolder = `workspace/projects/${projectId}/runs/${runId}`;
    await this.fileStore.writeMarkdown(`${destFolder}/.keep`, 'Keep file to ensure dir creation');

    // copy files
    const sourceFiles = await fs.readdir(sourceFolderPath);
    for (const file of sourceFiles) {
      const srcPath = path.join(sourceFolderPath, file);
      const content = await fs.readFile(srcPath, 'utf8');
      if (file.endsWith('.json')) {
        await this.fileStore.writeJSON(`${destFolder}/${file}`, JSON.parse(content));
      } else {
        await this.fileStore.writeMarkdown(`${destFolder}/${file}`, content);
      }
    }

    const now = new Date().toISOString();

    const structuredChangedFiles: RunChangedFile[] = changedFilesInfo.map(cf => ({
      path: cf.path,
      changeType: cf.change_type as any,
      purpose: cf.purpose,
      riskLevel: cf.risk_level as any
    }));

    const run: Run = {
      id: runId,
      projectId,
      taskId: taskIdOverride || (jobResult as any).task_id || 'UNKNOWN',
      activeRepoId: 'UNKNOWN',
      agentId: '',
      tool: jobResult.tool,
      model: jobResult.model,
      mode: 'WeakSAUCE',
      promptPath: '',
      artifactPaths: sourceFiles.map(f => `${destFolder}/${f}`),
      status: 'review' as any,
      summary: jobResult.summary,
      risks: jobResult.risks.map(r => ({
        description: r.description,
        severity: r.severity as any,
        mitigation: r.mitigation || ''
      })),
      validation: jobResult.manual_validation.map(v => ({
        check: v.check,
        result: v.result as any,
        notes: v.notes || ''
      })),
      changedFiles: structuredChangedFiles,
      commitHash: jobResult.commit_hash,
      createdAt: now,
      updatedAt: now
    };

    await this.fileStore.writeJSON(`${destFolder}/run.meta.json`, run);

    const changedFilePaths = structuredChangedFiles.map(cf => cf.path);
    const overlappingDocs = await this.knowledgeService.getDocsWithWatchFileOverlap(projectId, changedFilePaths);

    const staleDocIds: string[] = [];
    for (const doc of overlappingDocs) {
      await this.knowledgeService.flagStale(projectId, doc.id);
      staleDocIds.push(doc.id);
    }

    const resolvedTaskId = run.taskId;
    if (resolvedTaskId && resolvedTaskId !== 'UNKNOWN') {
      try {
        await this.taskService.linkRunToTask(projectId, resolvedTaskId, run.id);
      } catch { /* task may not exist, non-fatal */ }
    }

    return { run, staleDocIds };
  }

  async validateArtifacts(folderPath: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const files = await fs.readdir(folderPath);

    const required = ['job_result.json', 'changed_files.json', 'review_checklist.json', 'job_summary.md', 'code_snippets.md'];
    for (const req of required) {
      if (!files.includes(req)) errors.push(`Missing required artifact: ${req}`);
    }

    if (errors.length > 0) return { valid: false, errors };

    try {
      const jobResultRaw = JSON.parse(stripBom(await fs.readFile(path.join(folderPath, 'job_result.json'), 'utf8')));
      const changedFilesRaw = JSON.parse(stripBom(await fs.readFile(path.join(folderPath, 'changed_files.json'), 'utf8')));
      const reviewChecklistRaw = JSON.parse(stripBom(await fs.readFile(path.join(folderPath, 'review_checklist.json'), 'utf8')));

      const jobResult = this.normalizeJobResult(jobResultRaw);
      const changedFiles = this.normalizeChangedFiles(changedFilesRaw);
      const reviewChecklist = this.normalizeReviewChecklist(reviewChecklistRaw);

      const v1 = await this.schemaValidator.validate('job_result', jobResult);
      if (!v1.valid) errors.push(`job_result.json: ${v1.errors.join(', ')}`);

      const v2 = await this.schemaValidator.validate('changed_files', changedFiles);
      if (!v2.valid) errors.push(`changed_files.json: ${v2.errors.join(', ')}`);

      const v3 = await this.schemaValidator.validate('review_checklist', reviewChecklist);
      if (!v3.valid) errors.push(`review_checklist.json: ${v3.errors.join(', ')}`);
    } catch (e: any) {
      errors.push(`Error parsing JSON: ${e.message}`);
    }

    return { valid: errors.length === 0, errors };
  }

  async getRun(projectId: string, runId: string): Promise<Run | null> {
    // Check project repo path first, then internal fallback
    const runsBase = await this.getRunsBasePath(projectId);
    const externalMeta = path.join(runsBase, runId, 'run.meta.json');
    try {
      const raw = await fs.readFile(externalMeta, 'utf8');
      return JSON.parse(raw) as Run;
    } catch { /* try internal */ }
    try {
      return await this.fileStore.readJSON<Run>(`workspace/projects/${projectId}/runs/${runId}/run.meta.json`);
    } catch {
      return null;
    }
  }

  async listRuns(projectId: string): Promise<Run[]> {
    const runs: Run[] = [];
    const seenIds = new Set<string>();

    // Primary: project repo .c2/runs/ (or internal if no operationalPath)
    try {
      const runsBase = await this.getRunsBasePath(projectId);
      await fs.mkdir(runsBase, { recursive: true }).catch(() => {});
      const entries = await fs.readdir(runsBase, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          const metaPath = path.join(runsBase, entry.name, 'run.meta.json');
          const raw = await fs.readFile(metaPath, 'utf8');
          const run = JSON.parse(raw) as Run;
          if (run && !seenIds.has(run.id)) {
            runs.push(run);
            seenIds.add(run.id);
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }

    // Secondary: internal path (for backward compat with old runs)
    try {
      const internalBase = this.fileStore.resolvePath(`workspace/projects/${projectId}/runs`);
      const runsBase = await this.getRunsBasePath(projectId);
      // Only scan internal if it differs from primary (i.e. project has operationalPath set)
      if (internalBase !== runsBase) {
        const entries = await fs.readdir(internalBase, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          try {
            const metaPath = path.join(internalBase, entry.name, 'run.meta.json');
            const raw = await fs.readFile(metaPath, 'utf8');
            const run = JSON.parse(raw) as Run;
            if (run && !seenIds.has(run.id)) {
              runs.push(run);
              seenIds.add(run.id);
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }

    return runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Scan the runs folder for subdirectories that have job_result.json but NO run.meta.json.
   */
  async scanPendingRuns(projectId: string): Promise<Array<{ runId: string; folderPath: string; hasAllArtifacts: boolean; summary?: string; taskId?: string }>> {
    const pending: Array<{ runId: string; folderPath: string; hasAllArtifacts: boolean; summary?: string; taskId?: string }> = [];

    const scanDir = async (dirPath: string) => {
      try {
        await fs.mkdir(dirPath, { recursive: true }).catch(() => {});
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const fullPath = path.join(dirPath, entry.name);
          const metaPath = path.join(fullPath, 'run.meta.json');
          const metaExists = await fs.access(metaPath).then(() => true).catch(() => false);
          const jobResultExists = await fs.access(path.join(fullPath, 'job_result.json')).then(() => true).catch(() => false);

          let metaStatus: string | undefined;
          if (metaExists) {
            try {
              const meta = JSON.parse(await fs.readFile(metaPath, 'utf8')) as { status?: string };
              metaStatus = meta.status;
            } catch { /* ignore */ }
          }

          if ((jobResultExists && !metaExists) || (jobResultExists && metaStatus === 'importing')) {
            const validation = await this.validateArtifacts(fullPath);
            let summary: string | undefined;
            let taskId: string | undefined;
            try {
              const rawJr = JSON.parse(stripBom(await fs.readFile(path.join(fullPath, 'job_result.json'), 'utf8')));
              const jr = this.normalizeJobResult(rawJr);
              
              summary = typeof jr.summary === 'string' ? jr.summary : undefined;
              if (summary === 'No summary provided by agent.' || !summary) {
                summary = await this.getSummaryFallback(fullPath, summary || 'No summary provided by agent.');
              }
              
              if (jr.task_id) {
                taskId = String(jr.task_id);
              } else if (rawJr.task_id) {
                taskId = String(rawJr.task_id);
              }
            } catch { /* ignore */ }
            pending.push({ runId: entry.name, folderPath: fullPath, hasAllArtifacts: validation.valid, summary, taskId });
          }
        }
      } catch { /* skip */ }
    };

    // Scan project repo path
    const runsBase = await this.getRunsBasePath(projectId);
    await scanDir(runsBase);

    // Also scan internal path if different (backward compat)
    const internalBase = this.fileStore.resolvePath(`workspace/projects/${projectId}/runs`);
    if (internalBase !== runsBase) {
      await scanDir(internalBase);
    }

    return pending;
  }

  /**
   * Import a run that was written by the AI coding agent.
   * @param absoluteFolderPath - If provided, artifacts are read from this absolute path
   *   (used when the watcher detects a run in the project repo).
   *   If omitted, falls back to getRunsBasePath(projectId)/runId.
   */
  async importRunById(
    projectId: string,
    runId: string,
    taskId?: string,
    absoluteFolderPath?: string,
    force?: boolean
  ): Promise<{ run: Run; staleDocIds: string[] }> {
    // Determine the folder containing the run artifacts
    const runsBase = await this.getRunsBasePath(projectId);
    const fullPath = absoluteFolderPath || path.join(runsBase, runId);

    const jobResult = this.normalizeJobResult(
      JSON.parse(stripBom(await fs.readFile(path.join(fullPath, 'job_result.json'), 'utf8'))),
      taskId
    ) as unknown as JobResult;

    jobResult.summary = await this.getSummaryFallback(fullPath, jobResult.summary);

    // Optional files — force=true allows importing with stubs when they're missing
    let changedFilesRaw: string | null = null;
    let reviewChecklistRaw: string | null = null;
    try { changedFilesRaw = stripBom(await fs.readFile(path.join(fullPath, 'changed_files.json'), 'utf8')); } catch { /* missing */ }
    try { reviewChecklistRaw = stripBom(await fs.readFile(path.join(fullPath, 'review_checklist.json'), 'utf8')); } catch { /* missing */ }

    if (!changedFilesRaw && !force) throw new Error('changed_files.json missing — use Force Import to proceed anyway.');
    if (!reviewChecklistRaw && !force) throw new Error('review_checklist.json missing — use Force Import to proceed anyway.');

    const changedFilesInfo = this.normalizeChangedFiles(
      changedFilesRaw ? JSON.parse(changedFilesRaw) : []
    ) as unknown as ImportedChangedFile[];
    const reviewChecklist = this.normalizeReviewChecklist(
      reviewChecklistRaw ? JSON.parse(reviewChecklistRaw) : { checks_run: [], checks_skipped: [], unresolved_items: [] }
    ) as unknown as ImportedReviewChecklist;

    // Write normalized versions back to disk so future reads are clean
    await fs.writeFile(path.join(fullPath, 'job_result.json'), JSON.stringify(jobResult, null, 2), 'utf8').catch(() => {});
    await fs.writeFile(path.join(fullPath, 'changed_files.json'), JSON.stringify(changedFilesInfo, null, 2), 'utf8').catch(() => {});
    await fs.writeFile(path.join(fullPath, 'review_checklist.json'), JSON.stringify(reviewChecklist, null, 2), 'utf8').catch(() => {});

    const v1 = await this.schemaValidator.validate('job_result', jobResult);
    if (!v1.valid) throw new Error(`job_result validation failed: ${v1.errors.join(', ')}`);
    // Skip strict validation for optional files in force mode
    if (!force) {
      const v2 = await this.schemaValidator.validate('changed_files', changedFilesInfo);
      if (!v2.valid) throw new Error(`changed_files validation failed: ${v2.errors.join(', ')}`);
      const v3 = await this.schemaValidator.validate('review_checklist', reviewChecklist);
      if (!v3.valid) throw new Error(`review_checklist validation failed: ${v3.errors.join(', ')}`);
    }

    const resolvedTaskId = taskId || (jobResult as any).task_id || 'UNKNOWN';
    const now = new Date().toISOString();
    let existingMeta: Partial<Run> | null = null;
    try {
      existingMeta = JSON.parse(await fs.readFile(path.join(fullPath, 'run.meta.json'), 'utf8')) as Partial<Run>;
    } catch { /* optional */ }

    // Look for a prompt file saved at compile time (still in Command's internal storage)
    const candidatePromptPath = resolvedTaskId !== 'UNKNOWN'
      ? `workspace/projects/${projectId}/tasks/${resolvedTaskId}/prompts/PROMPT-${runId}.md`
      : '';
    let resolvedPromptPath = (jobResult as any).prompt_path || (jobResult as any).promptPath || existingMeta?.promptPath || '';
    if (!resolvedPromptPath && candidatePromptPath) {
      const exists = await fs.access(this.fileStore.resolvePath(candidatePromptPath)).then(() => true).catch(() => false);
      if (exists) resolvedPromptPath = candidatePromptPath;
    }

    const structuredChangedFiles: RunChangedFile[] = changedFilesInfo.map(cf => ({
      path: cf.path,
      changeType: cf.change_type as any,
      purpose: cf.purpose,
      riskLevel: cf.risk_level as any
    }));

    const run: Run = {
      id: runId,
      projectId,
      taskId: resolvedTaskId,
      activeRepoId: existingMeta?.activeRepoId || 'UNKNOWN',
      agentId: existingMeta?.agentId || '',
      tool: jobResult.tool,
      model: jobResult.model,
      mode: 'WeakSAUCE',
      promptPath: resolvedPromptPath,
      artifactPaths: ['job_result.json', 'changed_files.json', 'review_checklist.json', 'job_summary.md', 'code_snippets.md']
        .map(f => path.join(fullPath, f)),
      // Freshly imported runs always start at 'review' — the AI's own status field
      // (e.g. "success") is irrelevant to Command's workflow; the user must still review it.
      status: 'review' as any,
      summary: jobResult.summary,
      risks: jobResult.risks.map(r => ({ description: r.description, severity: r.severity as any, mitigation: r.mitigation || '' })),
      validation: jobResult.manual_validation.map(v => ({ check: v.check, result: v.result as any, notes: v.notes || '' })),
      changedFiles: structuredChangedFiles,
      commitHash: jobResult.commit_hash,
      timeline: existingMeta?.timeline || [],
      createdAt: now,
      updatedAt: now
    };

    // Write run.meta.json IN-PLACE in the run's actual folder
    await fs.mkdir(fullPath, { recursive: true }).catch(() => {});
    await fs.writeFile(path.join(fullPath, 'run.meta.json'), JSON.stringify(run, null, 2), 'utf8');

    const changedFilePaths = structuredChangedFiles.map(cf => cf.path);
    const overlappingDocs = await this.knowledgeService.getDocsWithWatchFileOverlap(projectId, changedFilePaths);
    const staleDocIds: string[] = [];
    for (const doc of overlappingDocs) {
      await this.knowledgeService.flagStale(projectId, doc.id);
      staleDocIds.push(doc.id);
    }

    if (resolvedTaskId && resolvedTaskId !== 'UNKNOWN') {
      try { await this.taskService.linkRunToTask(projectId, resolvedTaskId, run.id); } catch { /* non-fatal */ }
    }

    // Promote knowledge_updates/ subfolder
    const updatedKnowledgeDocs: string[] = [];
    try {
      const knowledgeUpdatesPath = path.join(fullPath, 'knowledge_updates');
      const updatesExist = await fs.access(knowledgeUpdatesPath).then(() => true).catch(() => false);
      if (updatesExist) {
        const updateFiles = await fs.readdir(knowledgeUpdatesPath);
        for (const file of updateFiles) {
          if (!file.endsWith('.md')) continue;
          const content = await fs.readFile(path.join(knowledgeUpdatesPath, file), 'utf8');
          if (file === 'carry_forward.md' && resolvedTaskId && resolvedTaskId !== 'UNKNOWN') {
            await this.fileStore.writeMarkdown(`workspace/projects/${projectId}/tasks/${resolvedTaskId}/carry_forward.md`, content);
            updatedKnowledgeDocs.push('carry_forward (task)');
          } else {
            await this.fileStore.writeMarkdown(`workspace/projects/${projectId}/knowledge/docs/${file}`, content);
            updatedKnowledgeDocs.push(file);
          }
        }
      }
    } catch { /* non-fatal */ }

    if (updatedKnowledgeDocs.length > 0) {
      run.knowledgeDocsUpdated = updatedKnowledgeDocs;
      await fs.writeFile(path.join(fullPath, 'run.meta.json'), JSON.stringify(run, null, 2), 'utf8');
    }

    // Record import event in timeline
    await this.appendToTimeline(projectId, run.id, {
      type: 'imported',
      title: 'Run Imported',
      content: run.summary || 'No summary',
      metadata: { knowledgeDocsUpdated: updatedKnowledgeDocs },
    });

    return { run, staleDocIds, updatedKnowledgeDocs } as { run: Run; staleDocIds: string[]; updatedKnowledgeDocs: string[] };
  }
}
