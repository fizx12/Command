import { ipcMain } from 'electron'
import { RunImporterService } from '../services/run-importer.service'

export function registerRunHandlers(runImporterService: RunImporterService): void {
  ipcMain.handle('runs:list', async (_event, projectId: string) => {
    try {
      const result = await runImporterService.listRuns(projectId)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('runs:get', async (_event, projectId: string, runId: string) => {
    try {
      const result = await runImporterService.getRun(projectId, runId)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('runs:import', async (_event, projectId: string, folderPath: string) => {
    try {
      const result = await runImporterService.importRun(projectId, folderPath)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })
}
