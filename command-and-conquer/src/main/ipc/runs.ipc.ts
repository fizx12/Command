import { ipcMain } from 'electron'
import * as path from 'path'
import { RunImporterService } from '../services/run-importer.service'
import { FileStore } from '../storage/file-store'

export function registerRunHandlers(runImporterService: RunImporterService, fileStore: FileStore): void {
  ipcMain.handle('runs:list', async (_event, projectId: string) => {
    try {
      const result = await runImporterService.listRuns(projectId)
      return { error: false, data: result }
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('runs:get', async (_event, projectId: string, runId: string) => {
    try {
      const result = await runImporterService.getRun(projectId, runId)
      return { error: false, data: result }
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('runs:delete', async (_event, projectId: string, runId: string) => {
    try {
      await runImporterService.deleteRun(projectId, runId)
      return { error: false }
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('runs:import', async (_event, projectId: string, folderPath: string) => {
    try {
      const result = await runImporterService.importRun(projectId, folderPath)
      return { error: false, data: result }
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Scan runs folder for AI-written artifacts that haven't been imported yet
  ipcMain.handle('runs:scan-pending', async (_event, projectId: string) => {
    try {
      const result = await runImporterService.scanPendingRuns(projectId)
      return { error: false, data: result }
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Import a run that already lives in the workspace (AI wrote it there directly).
  // folderPath: exact folder where artifacts are — passed from scanPending so we always
  // read from the right location regardless of current hub config.
  ipcMain.handle('runs:import-by-id', async (_event, projectId: string, runId: string, taskId?: string, folderPath?: string, force?: boolean) => {
    try {
      const result = await runImporterService.importRunById(projectId, runId, taskId, folderPath || undefined, force)
      return { error: false, data: result }
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Read the compiled prompt that was saved when this run was dispatched
  ipcMain.handle('runs:read-prompt', async (_event, promptPath: string) => {
    try {
      const text = await fileStore.readMarkdown(promptPath)
      return { error: false, data: text }
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Prompt not found' }
    }
  })

  // Append an entry to a run's timeline
  ipcMain.handle('runs:append-timeline', async (_event, projectId: string, runId: string, entry: Record<string, unknown>) => {
    try {
      await runImporterService.appendToTimeline(projectId, runId, entry as any);
      return { error: false };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Generate a new run ID and return the absolute output path for that run.
  // Used by the revision prompt builder so it embeds the same absolute .c2/runs path
  // that the watcher monitors (avoids writing to a relative path that goes undetected).
  ipcMain.handle('runs:new-run-path', async (_event, projectId: string) => {
    try {
      const runId = 'RUN-' + String(Date.now()).slice(-6);
      const runsBase = await runImporterService.getRunsBasePath(projectId);
      const absolutePath = path.join(runsBase, runId);
      return { error: false, data: { runId, absolutePath } };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}
