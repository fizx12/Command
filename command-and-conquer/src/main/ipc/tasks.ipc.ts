import { ipcMain } from 'electron'
import { TaskService } from '../services/task.service'

export function registerTaskHandlers(taskService: TaskService): void {
  ipcMain.handle('tasks:list', async (_event, projectId: string) => {
    try {
      const result = await taskService.listTasks(projectId)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('tasks:get', async (_event, projectId: string, taskId: string) => {
    try {
      const result = await taskService.getTask(projectId, taskId)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('tasks:create', async (_event, projectId: string, data) => {
    try {
      const result = await taskService.createTask(projectId, data)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('tasks:update', async (_event, projectId: string, taskId: string, data) => {
    try {
      const result = await taskService.updateTask(projectId, taskId, data)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('tasks:delete', async (_event, projectId: string, taskId: string) => {
    try {
      await taskService.deleteTask(projectId, taskId)
      return { error: false }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })
}
