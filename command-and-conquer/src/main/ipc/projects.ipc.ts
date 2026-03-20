import { ipcMain } from 'electron'
import { ProjectService } from '../services/project.service'
import { FullRepoContextService } from '../services/full-repo-context.service'

export function registerProjectHandlers(projectService: ProjectService, fullRepoContextService?: FullRepoContextService): void {
  ipcMain.handle('projects:list', async () => {
    try {
      const result = await projectService.listProjects()
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('projects:get', async (_event, id: string) => {
    try {
      const result = await projectService.getProject(id)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('projects:create', async (_event, data) => {
    try {
      const result = await projectService.createProject(data)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('projects:update', async (_event, id: string, data) => {
    try {
      const result = await projectService.updateProject(id, data)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('projects:delete', async (_event, id: string) => {
    try {
      const result = await projectService.deleteProject(id)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('projects:listRepos', async (_event, projectId: string) => {
    try {
      const result = await projectService.listRepos(projectId)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('projects:addRepo', async (_event, data) => {
    try {
      const result = await projectService.addRepo(data)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  if (fullRepoContextService) {
    ipcMain.handle('projects:build-full-repo-context', async (_event, projectId: string) => {
      try {
        const result = await fullRepoContextService.buildFullRepoContext(projectId)
        return { error: false, data: result }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    })
  }
}
