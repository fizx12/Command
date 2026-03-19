import { ipcMain } from 'electron'
import { KnowledgeService } from '../services/knowledge.service'
import { FileStore } from '../storage/file-store'
import { DecisionAnchor } from '../types'

export function registerKnowledgeHandlers(knowledgeService: KnowledgeService): void {
  ipcMain.handle('knowledge:listDocs', async (_event, projectId: string) => {
    try {
      const result = await knowledgeService.listDocs(projectId)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('knowledge:getDoc', async (_event, projectId: string, docId: string) => {
    try {
      const result = await knowledgeService.getDoc(projectId, docId)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('knowledge:listSolved', async (_event, projectId: string) => {
    try {
      const result = await knowledgeService.listSolvedIssues(projectId)
      return { error: false, data: result }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('knowledge:listAnchors', async (_event, projectId: string) => {
    try {
      const fileStore = (knowledgeService as unknown as { fileStore?: FileStore }).fileStore as FileStore
      const tasksPath = `workspace/projects/${projectId}/tasks`
      const taskDirectories = await (fileStore as unknown as {
        listDirectories: (path: string) => Promise<string[]>
      }).listDirectories(tasksPath)

      const anchors: DecisionAnchor[] = []

      for (const taskDirectory of taskDirectories) {
        const anchorPath = `${tasksPath}/${taskDirectory}/decision_anchor.json`
        const exists = await (fileStore as unknown as {
          exists: (path: string) => Promise<boolean>
        }).exists(anchorPath)

        if (!exists) {
          continue
        }

        const anchor = await (fileStore as unknown as {
          readJSON: <T>(path: string) => Promise<T>
        }).readJSON<DecisionAnchor>(anchorPath)

        anchors.push(anchor)
      }

      return { error: false, data: anchors }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })
}
