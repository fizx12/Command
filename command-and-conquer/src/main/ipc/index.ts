import { registerProjectHandlers } from './projects.ipc'
import { registerTaskHandlers } from './tasks.ipc'
import { registerRunHandlers } from './runs.ipc'
import { registerKnowledgeHandlers } from './knowledge.ipc'
import { registerPromptHandlers } from './prompts.ipc'
import { registerSettingsHandlers } from './settings.ipc'
import { registerSystemHandlers } from './system.ipc'
import { registerGeminiHandlers } from './gemini.ipc'
import { PromptRefinerService } from '../services/prompt-refiner.service'
import { PromptFuserService } from '../services/prompt-fuser.service'
import { RepoContextService } from '../services/repo-context.service'
import { RunEvaluatorService } from '../services/run-evaluator.service'

export function registerAllHandlers(services: {
  projectService: any
  taskService: any
  runImporterService: any
  knowledgeService: any
  promptCompilerService: any
  fileStore: any
  geminiService: any
  bootstrapKnowledgeService: any
  promptRefinerService: PromptRefinerService
  promptFuserService: PromptFuserService
  repoContextService: RepoContextService
  runEvaluatorService: RunEvaluatorService
}): void {
  registerProjectHandlers(services.projectService)
  registerTaskHandlers(services.taskService)
  registerRunHandlers(services.runImporterService, services.fileStore)
  registerKnowledgeHandlers(services.knowledgeService, services.fileStore)
  registerPromptHandlers(services.promptCompilerService, services.fileStore)
  registerSettingsHandlers(services.fileStore)
  registerSystemHandlers()
  registerGeminiHandlers(
    services.geminiService,
    services.bootstrapKnowledgeService,
    services.promptCompilerService,
    services.fileStore,
    services.promptRefinerService,
    services.promptFuserService,
    services.repoContextService,
    services.runEvaluatorService
  )
}
