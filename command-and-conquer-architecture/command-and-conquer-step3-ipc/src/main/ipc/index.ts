import { registerProjectHandlers } from './projects.ipc'
import { registerTaskHandlers } from './tasks.ipc'
import { registerRunHandlers } from './runs.ipc'
import { registerKnowledgeHandlers } from './knowledge.ipc'
import { registerPromptHandlers } from './prompts.ipc'
import { registerSettingsHandlers } from './settings.ipc'

export function registerAllHandlers(services: {
  projectService: any
  taskService: any
  runImporterService: any
  knowledgeService: any
  promptCompilerService: any
  fileStore: any
}): void {
  registerProjectHandlers(services.projectService)
  registerTaskHandlers(services.taskService)
  registerRunHandlers(services.runImporterService)
  registerKnowledgeHandlers(services.knowledgeService)
  registerPromptHandlers(services.promptCompilerService)
  registerSettingsHandlers(services.fileStore)
}
