import { ipcMain } from 'electron'
import { PromptCompilerService } from '../services/prompt-compiler.service'
import { FileStore } from '../storage/file-store'
import { PromptStep } from '../types'

export function registerPromptHandlers(promptCompilerService: PromptCompilerService, fileStore: FileStore): void {
  ipcMain.handle('prompts:compile', async (_event, projectId: string, taskId: string, step: string, taskMode: string = 'implement') => {
    try {
      const promptStep: PromptStep = step === 'implement' ? 'implement' : 'plan';
      const promptTaskMode = taskMode === 'audit' || taskMode === 'regression' ? taskMode : 'implement';
      const result = await promptCompilerService.compile(projectId, taskId, promptStep, 'MAX', promptTaskMode)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('prompts:preview', async (_event, projectId: string, taskId: string, step: string, taskMode: string = 'implement') => {
    try {
      const promptStep: PromptStep = step === 'implement' ? 'implement' : 'plan';
      const promptTaskMode = taskMode === 'audit' || taskMode === 'regression' ? taskMode : 'implement';
      const result = await promptCompilerService.preview(projectId, taskId, promptStep, 'MAX', promptTaskMode)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // The prompt text is saved when the user clicks Compile & Copy
  ipcMain.handle('prompts:save', async (_event, projectId: string, taskId: string, runId: string, text: string) => {
    try {
      const promptPath = `workspace/projects/${projectId}/tasks/${taskId}/prompts/PROMPT-${runId}.md`
      await fileStore.writeMarkdown(promptPath, text)
      return { error: false }
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('prompts:build-architect', async (_event, projectId: string, taskId: string, targetCoder: '5.4mini' | 'flash' = '5.4mini', taskMode: string = 'implement') => {
    try {
      const promptTaskMode = taskMode === 'audit' || taskMode === 'regression' ? taskMode : 'implement';
      const payload = await promptCompilerService.buildArchitectPayload(projectId, taskId, targetCoder, promptTaskMode);
      return { error: false, data: { payload } };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('prompts:compile-architect', async (_event, projectId: string, taskId: string, architectOutput: string) => {
    try {
      const result = await promptCompilerService.compileFromArchitectOutput(projectId, taskId, architectOutput);
      return { error: false, data: result };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}
