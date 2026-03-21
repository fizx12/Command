import { contextBridge, ipcRenderer } from 'electron';
import {
  CreateProjectInput,
  UpdateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateRepoInput
} from '../main/types';

contextBridge.exposeInMainWorld('api', {
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    get: (id: string) => ipcRenderer.invoke('projects:get', id),
    create: (data: CreateProjectInput) => ipcRenderer.invoke('projects:create', data),
    update: (id: string, data: UpdateProjectInput) => ipcRenderer.invoke('projects:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id),
    listRepos: (projectId: string) => ipcRenderer.invoke('projects:listRepos', projectId),
    addRepo: (data: CreateRepoInput) => ipcRenderer.invoke('projects:addRepo', data),
    buildFullRepoContext: (projectId: string) => ipcRenderer.invoke('projects:build-full-repo-context', projectId),
  },
  tasks: {
    list: (projectId: string) => ipcRenderer.invoke('tasks:list', projectId),
    get: (projectId: string, taskId: string) => ipcRenderer.invoke('tasks:get', projectId, taskId),
    create: (projectId: string, data: CreateTaskInput) => ipcRenderer.invoke('tasks:create', projectId, data),
    update: (projectId: string, taskId: string, data: UpdateTaskInput) => ipcRenderer.invoke('tasks:update', projectId, taskId, data),
    delete: (projectId: string, taskId: string) => ipcRenderer.invoke('tasks:delete', projectId, taskId),
  },
  runs: {
    list: (projectId: string) => ipcRenderer.invoke('runs:list', projectId),
    get: (projectId: string, runId: string) => ipcRenderer.invoke('runs:get', projectId, runId),
    delete: (projectId: string, runId: string) => ipcRenderer.invoke('runs:delete', projectId, runId),
    import: (projectId: string, folderPath: string) => ipcRenderer.invoke('runs:import', projectId, folderPath),
    scanPending: (projectId: string) => ipcRenderer.invoke('runs:scan-pending', projectId),
    importById: (projectId: string, runId: string, taskId?: string, folderPath?: string, force?: boolean) => ipcRenderer.invoke('runs:import-by-id', projectId, runId, taskId, folderPath, force),
    readPrompt: (promptPath: string) => ipcRenderer.invoke('runs:read-prompt', promptPath),
    appendTimeline: (projectId: string, runId: string, entry: Record<string, unknown>) =>
      ipcRenderer.invoke('runs:append-timeline', projectId, runId, entry),
    evaluate: (taskSpec: Record<string, string>, artifacts: Record<string, unknown>, apiKey: string) =>
      ipcRenderer.invoke('runs:evaluate', taskSpec, artifacts, apiKey),
    newRunPath: (projectId: string) =>
      ipcRenderer.invoke('runs:new-run-path', projectId),
  },
  knowledge: {
    listDocs: (projectId: string) => ipcRenderer.invoke('knowledge:listDocs', projectId),
    getDoc: (projectId: string, docId: string) => ipcRenderer.invoke('knowledge:getDoc', projectId, docId),
    listSolved: (projectId: string) => ipcRenderer.invoke('knowledge:listSolved', projectId),
    listAnchors: (projectId: string) => ipcRenderer.invoke('knowledge:listAnchors', projectId),
  },
  prompts: {
    compile: (projectId: string, taskId: string, agentId: string, taskMode?: 'implement' | 'audit' | 'regression') => ipcRenderer.invoke('prompts:compile', projectId, taskId, agentId, taskMode),
    preview: (projectId: string, taskId: string, agentId: string, taskMode?: 'implement' | 'audit' | 'regression') => ipcRenderer.invoke('prompts:preview', projectId, taskId, agentId, taskMode),
    save: (projectId: string, taskId: string, runId: string, text: string) => ipcRenderer.invoke('prompts:save', projectId, taskId, runId, text),
    fuseAnalysis: (originalPrompt: string, llmOutput: string, apiKey: string) => ipcRenderer.invoke('prompts:fuse-analysis', originalPrompt, llmOutput, apiKey),
    buildArchitect: (projectId: string, taskId: string, targetCoder?: '5.4mini' | 'flash', taskMode?: 'implement' | 'audit' | 'regression') => ipcRenderer.invoke('prompts:build-architect', projectId, taskId, targetCoder, taskMode),
    compileArchitect: (projectId: string, taskId: string, architectOutput: string) => ipcRenderer.invoke('prompts:compile-architect', projectId, taskId, architectOutput),
  },
  gemini: {
    testKey: (apiKey: string) => ipcRenderer.invoke('gemini:test-key', apiKey),
    bootstrapKnowledge: (projectId: string, sourcePath: string, apiKey: string) => ipcRenderer.invoke('knowledge:bootstrap', projectId, sourcePath, apiKey),
    sendToFlash: (projectId: string, taskId: string, agentId: string, apiKey: string) => ipcRenderer.invoke('prompts:send-to-flash', projectId, taskId, agentId, apiKey),
    tightenPrompt: (promptText: string, apiKey: string, purpose?: 'prompt' | 'revision') =>
      ipcRenderer.invoke('prompts:tighten', promptText, apiKey, purpose),
    generateRepoContext: (projectId: string, repoPath: string, apiKey: string) =>
      ipcRenderer.invoke('repos:generate-context', projectId, repoPath, apiKey),
    improveTask: (title: string, description: string, apiKey: string) =>
      ipcRenderer.invoke('tasks:improve-description', title, description, apiKey),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (data: any) => ipcRenderer.invoke('settings:update', data),
    selectFolder: () => ipcRenderer.invoke('settings:selectFolder'),
  },
  system: {
    getHealth: (projectId: string) => ipcRenderer.invoke('system:getHealth', projectId),
    openFolder: (folderPath: string) => ipcRenderer.invoke('system:open-folder', folderPath),
  },
  onRunAutoImported: (callback: (payload: Record<string, unknown>) => void) => {
    const listener = (_event: unknown, payload: Record<string, unknown>) => callback(payload);
    ipcRenderer.on('run:auto-imported', listener);
    return () => {
      ipcRenderer.off('run:auto-imported', listener);
    };
  },
});
