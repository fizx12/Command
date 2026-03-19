# STEP 3 — IPC HANDLERS (Cheap Coder — all 6 can run in parallel)

## ⚠️ For EVERY prompt below, send it as:
1. CONTEXT_BUNDLE.md
2. The type files from Step 1B
3. `src/preload/api.ts` from Step 1A (so the coder sees the channel names)
4. The specific service file this handler wraps (from Step 2 output)
5. The prompt below

Run AFTER Step 2 review passes. All 6 are independent — fire them all at once.
Use Gemini Flash for all of these — they're thin wrappers.

---

## I1: `src/main/ipc/projects.ipc.ts` → Flash

```
You are a code writer. Follow these instructions exactly. Do not add features.

TECH STACK: TypeScript strict mode, Electron ipcMain

FILE TO CREATE: src/main/ipc/projects.ipc.ts

IMPORTS:
- { ipcMain } from 'electron'
- { ProjectService } from '../services/project.service'

EXPORT: a function registerProjectHandlers(projectService: ProjectService): void

This function registers these IPC handlers:

1. 'projects:list' → projectService.listProjects()
2. 'projects:get' → (event, id: string) → projectService.getProject(id)
3. 'projects:create' → (event, data) → projectService.createProject(data)
4. 'projects:update' → (event, id: string, data) → projectService.updateProject(id, data)
5. 'projects:delete' → (event, id: string) → projectService.deleteProject(id)

Each handler:
- Uses ipcMain.handle(channel, async (event, ...args) => { ... })
- Wraps the service call in try/catch
- On error: return { error: true, message: error.message }
- On success: return { error: false, data: result }

DOES NOT:
- Validate input shapes (trust the preload types)
- Access FileStore directly
- Import anything except what's listed above

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## I2: `src/main/ipc/tasks.ipc.ts` → Flash

```
You are a code writer. Follow these instructions exactly. Do not add features.

FILE TO CREATE: src/main/ipc/tasks.ipc.ts

IMPORTS:
- { ipcMain } from 'electron'
- { TaskService } from '../services/task.service'

EXPORT: registerTaskHandlers(taskService: TaskService): void

Handlers:
1. 'tasks:list' → (event, projectId: string) → taskService.listTasks(projectId)
2. 'tasks:get' → (event, projectId: string, taskId: string) → taskService.getTask(projectId, taskId)
3. 'tasks:create' → (event, projectId: string, data) → taskService.createTask(projectId, data)
4. 'tasks:update' → (event, projectId: string, taskId: string, data) → taskService.updateTask(projectId, taskId, data)

Same try/catch pattern: return { error: false, data } or { error: true, message }.

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## I3: `src/main/ipc/runs.ipc.ts` → Flash

```
You are a code writer. Follow these instructions exactly. Do not add features.

FILE TO CREATE: src/main/ipc/runs.ipc.ts

IMPORTS:
- { ipcMain } from 'electron'
- { RunImporterService } from '../services/run-importer.service'

EXPORT: registerRunHandlers(runImporterService: RunImporterService): void

Handlers:
1. 'runs:list' → (event, projectId: string) → runImporterService.listRuns(projectId)
2. 'runs:get' → (event, projectId: string, runId: string) → runImporterService.getRun(projectId, runId)
3. 'runs:import' → (event, projectId: string, folderPath: string) → runImporterService.importRun(projectId, folderPath)

Same try/catch wrapper pattern.

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## I4: `src/main/ipc/knowledge.ipc.ts` → Flash

```
You are a code writer. Follow these instructions exactly. Do not add features.

FILE TO CREATE: src/main/ipc/knowledge.ipc.ts

IMPORTS:
- { ipcMain } from 'electron'
- { KnowledgeService } from '../services/knowledge.service'

EXPORT: registerKnowledgeHandlers(knowledgeService: KnowledgeService): void

Handlers:
1. 'knowledge:listDocs' → (event, projectId: string) → knowledgeService.listDocs(projectId)
2. 'knowledge:getDoc' → (event, projectId: string, docId: string) → knowledgeService.getDoc(projectId, docId)
3. 'knowledge:listSolved' → (event, projectId: string) → knowledgeService.listSolvedIssues(projectId)
4. 'knowledge:listAnchors' → (event, projectId: string) → list files from 'workspace/projects/{projectId}/tasks/*/decision_anchor.json', read each, return array

For handler 4, the knowledgeService doesn't have a listAnchors method. Instead, import FileStore and read anchor files directly:
- List all task directories
- For each, check if decision_anchor.json exists
- Read it if so
- Return array of DecisionAnchor objects

Same try/catch pattern.

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## I5: `src/main/ipc/prompts.ipc.ts` → Flash

```
You are a code writer. Follow these instructions exactly. Do not add features.

FILE TO CREATE: src/main/ipc/prompts.ipc.ts

IMPORTS:
- { ipcMain } from 'electron'
- { PromptCompilerService } from '../services/prompt-compiler.service'

EXPORT: registerPromptHandlers(promptCompilerService: PromptCompilerService): void

Handlers:
1. 'prompts:compile' → (event, projectId: string, taskId: string, agentId: string) → promptCompilerService.compile(projectId, taskId, agentId, 'MAX')
2. 'prompts:preview' → (event, projectId: string, taskId: string, agentId: string) → promptCompilerService.preview(projectId, taskId, agentId, 'MAX')

Note: mode defaults to 'MAX' for now. In the future the renderer will send mode as a parameter.

Same try/catch pattern.

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## I6: `src/main/ipc/settings.ipc.ts` → Flash

```
You are a code writer. Follow these instructions exactly. Do not add features.

FILE TO CREATE: src/main/ipc/settings.ipc.ts

IMPORTS:
- { ipcMain, dialog } from 'electron'
- { FileStore } from '../storage/file-store'

EXPORT: registerSettingsHandlers(fileStore: FileStore): void

Handlers:
1. 'settings:get' → read 'system/settings.json' via fileStore.readJSON, return it (or return default settings object if file missing)
2. 'settings:update' → (event, data) → read existing settings, merge data, write back via fileStore.writeJSON
3. 'settings:selectFolder' → use dialog.showOpenDialog({ properties: ['openDirectory'] }) to let user pick a folder, return the selected path or null if cancelled

Default settings object:
{
  obsidianVaultPath: '',
  operationalPath: '',
  watchFolders: [],
  defaultModel: 'gemini-flash',
  theme: 'dark'
}

Same try/catch pattern.

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## ALSO: `src/main/ipc/index.ts` → Flash

```
You are a code writer. Follow these instructions exactly.

FILE TO CREATE: src/main/ipc/index.ts

PURPOSE: Barrel file that imports all IPC registration functions and exports a single registerAllHandlers function.

IMPORTS:
- registerProjectHandlers from './projects.ipc'
- registerTaskHandlers from './tasks.ipc'
- registerRunHandlers from './runs.ipc'
- registerKnowledgeHandlers from './knowledge.ipc'
- registerPromptHandlers from './prompts.ipc'
- registerSettingsHandlers from './settings.ipc'

EXPORT: function registerAllHandlers(services: {
  projectService: any;
  taskService: any;
  runImporterService: any;
  knowledgeService: any;
  promptCompilerService: any;
  fileStore: any;
}): void

This function calls each registration function passing the appropriate service.

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## STEP 3 REVIEW — PASTE INTO SMART AI

```
Review these 7 IPC handler files. Check:

1. Do channel names EXACTLY match what's in preload.ts / api.ts?
2. Do all handlers use the same { error, data } / { error, message } return pattern?
3. Does the index.ts barrel correctly import and call all registration functions?
4. Are the service method names called correctly (match what services export)?
5. Is the knowledge:listAnchors handler reading from the right path pattern?

Output: issues with fixes, or "IPC HANDLERS APPROVED."

{PASTE ALL 7 FILES HERE}
```
