import { ipcMain } from 'electron'
import { PromptCompilerService } from '../services/prompt-compiler.service'

export function registerPromptHandlers(promptCompilerService: PromptCompilerService): void {
  ipcMain.handle('prompts:compile', async (_event, projectId: string, taskId: string, agentId: string) => {
    try {
      const result = await promptCompilerService.compile(projectId, taskId, agentId, 'MAX')
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('prompts:preview', async (_event, projectId: string, taskId: string, agentId: string) => {
    try {
      const result = await promptCompilerService.preview(projectId, taskId, agentId, 'MAX')
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })
}
