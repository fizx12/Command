import { ipcMain, shell } from 'electron'

export function registerSystemHandlers(): void {
  ipcMain.handle('system:getHealth', async (_event, projectId: string) => {
    try {
      // Mock health data for now, could be expanded to check file existence etc.
      return { 
        error: false, 
        data: {
          status: 'healthy',
          projectId,
          lastCheck: new Date().toISOString(),
          checks: [
            { name: 'Storage', status: 'pass' },
            { name: 'Context', status: 'pass' }
          ]
        } 
      }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('system:open-folder', async (_event, folderPath: string) => {
    try {
      if (!folderPath || !folderPath.trim()) {
        return { error: true, message: 'Folder path is required' }
      }

      const result = await shell.openPath(folderPath)
      if (result) {
        return { error: true, message: result }
      }

      return { error: false, data: { opened: true } }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })
}
