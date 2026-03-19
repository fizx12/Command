import { ipcMain } from 'electron'

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
}
