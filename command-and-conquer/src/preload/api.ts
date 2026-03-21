import {
  CreateProjectInput,
  UpdateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateRepoInput,
  CreateAnchorInput,
  CreateClosureInput,
  CreateConflictInput
} from '../main/types';

export interface ElectronAPI {
  projects: {
    list: () => Promise<any>;
    get: (id: string) => Promise<any>;
    create: (data: CreateProjectInput) => Promise<any>;
    update: (id: string, data: UpdateProjectInput) => Promise<any>;
    delete: (id: string) => Promise<any>;
    listRepos: (projectId: string) => Promise<any>;
    addRepo: (data: CreateRepoInput) => Promise<any>;
    buildFullRepoContext: (projectId: string) => Promise<any>;
  };
  tasks: {
    list: (projectId: string) => Promise<any>;
    get: (projectId: string, taskId: string) => Promise<any>;
    create: (projectId: string, data: CreateTaskInput) => Promise<any>;
    update: (projectId: string, taskId: string, data: UpdateTaskInput) => Promise<any>;
    delete: (projectId: string, taskId: string) => Promise<any>;
  };
  runs: {
    list: (projectId: string) => Promise<any>;
    get: (projectId: string, runId: string) => Promise<any>;
    delete: (projectId: string, runId: string) => Promise<any>;
    import: (projectId: string, folderPath: string) => Promise<any>;
    scanPending: (projectId: string) => Promise<any>;
    importById: (projectId: string, runId: string, taskId?: string, folderPath?: string, force?: boolean) => Promise<any>;
    readPrompt: (promptPath: string) => Promise<any>;
    appendTimeline: (projectId: string, runId: string, entry: Record<string, unknown>) => Promise<any>;
    evaluate: (taskSpec: Record<string, string>, artifacts: Record<string, unknown>, apiKey: string) => Promise<any>;
    newRunPath: (projectId: string) => Promise<any>;
  };
  knowledge: {
    listDocs: (projectId: string) => Promise<any>;
    getDoc: (projectId: string, docId: string) => Promise<any>;
    listSolved: (projectId: string) => Promise<any>;
    listAnchors: (projectId: string) => Promise<any>;
  };
  prompts: {
    compile: (projectId: string, taskId: string, step: string, taskMode?: 'implement' | 'audit' | 'regression') => Promise<any>;
    preview: (projectId: string, taskId: string, step: string, taskMode?: 'implement' | 'audit' | 'regression') => Promise<any>;
    save: (projectId: string, taskId: string, runId: string, text: string) => Promise<any>;
    fuseAnalysis: (originalPrompt: string, llmOutput: string, apiKey: string) => Promise<any>;
    buildArchitect: (projectId: string, taskId: string, targetCoder?: '5.4mini' | 'flash', taskMode?: 'implement' | 'audit' | 'regression') => Promise<any>;
    compileArchitect: (projectId: string, taskId: string, architectOutput: string) => Promise<any>;
  };
  gemini: {
    testKey: (apiKey: string) => Promise<any>;
    bootstrapKnowledge: (projectId: string, sourcePath: string, apiKey: string) => Promise<any>;
    sendToFlash: (projectId: string, taskId: string, step: string, apiKey: string) => Promise<any>;
    tightenPrompt: (promptText: string, apiKey: string, purpose?: 'prompt' | 'revision') => Promise<any>;
    generateRepoContext: (projectId: string, repoPath: string, apiKey: string) => Promise<any>;
    improveTask: (title: string, description: string, apiKey: string) => Promise<any>;
  };
  settings: {
    get: () => Promise<any>;
    update: (data: any) => Promise<any>;
    selectFolder: () => Promise<any>;
  };
  system: {
    getHealth: (projectId: string) => Promise<any>;
    openFolder: (folderPath: string) => Promise<any>;
  };
  onRunAutoImported: (callback: (payload: Record<string, unknown>) => void) => () => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
