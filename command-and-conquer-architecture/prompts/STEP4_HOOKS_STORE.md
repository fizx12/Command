# STEP 4 — HOOKS + STORE (Cheap Coder — all 6 can run in parallel)

## ⚠️ For EVERY prompt below, send it as:
1. CONTEXT_BUNDLE.md
2. `src/preload/api.ts` from Step 1A (hooks need to know window.api shape)
3. The type files from Step 1B (hooks return typed data)
4. The prompt below

Run AFTER Step 3 review. These wrap IPC calls for React components.

---

## H1: `src/renderer/hooks/useIPC.ts` → Haiku

```
You are a code writer. Follow these instructions exactly. Do not add features.

TECH STACK: React 18, TypeScript strict mode

FILE TO CREATE: src/renderer/hooks/useIPC.ts

PURPOSE: Generic hook that wraps any window.api call with loading/error state.

```typescript
import { useState, useCallback } from 'react';

interface UseIPCResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<T | null>;
}

export function useIPC<T>(apiFn: (...args: any[]) => Promise<any>): UseIPCResult<T> {
  // useState for data, loading, error
  // execute function:
  //   1. Set loading=true, error=null
  //   2. Call apiFn with args
  //   3. If result.error: set error=result.message, return null
  //   4. If success: set data=result.data, return result.data
  //   5. Catch: set error=caught.message
  //   6. Finally: set loading=false
  // Return { data, loading, error, execute }
}
```

Also export a useIPCQuery hook that auto-executes on mount:

```typescript
export function useIPCQuery<T>(apiFn: (...args: any[]) => Promise<any>, ...args: any[]): UseIPCResult<T> {
  // Uses useIPC internally
  // Calls execute(...args) in a useEffect on mount
  // Returns same shape
}
```

DOES NOT:
- Cache results
- Retry on failure
- Access window.api directly (receives the function as parameter)

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## H2: `src/renderer/hooks/useProjects.ts` → Flash

```
You are a code writer. Follow these instructions exactly.

FILE TO CREATE: src/renderer/hooks/useProjects.ts

IMPORTS:
- useIPC, useIPCQuery from './useIPC'
- Project, CreateProjectInput, UpdateProjectInput from types (declare window.api inline or import from preload/api)

EXPORTS:

1. useProjects(): returns { projects: Project[], loading, error, refresh }
   - Uses useIPCQuery with window.api.projects.list

2. useProject(id: string): returns { project: Project | null, loading, error, refresh }
   - Uses useIPCQuery with window.api.projects.get, passing id

3. useCreateProject(): returns { create: (data: CreateProjectInput) => Promise<Project | null>, loading, error }
   - Uses useIPC with window.api.projects.create

4. useUpdateProject(): returns { update: (id: string, data: UpdateProjectInput) => Promise<Project | null>, loading, error }
   - Uses useIPC with window.api.projects.update

Declare window.api type at top of file:
declare global { interface Window { api: any } }

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## H3: `src/renderer/hooks/useTasks.ts` → Flash

```
You are a code writer. Follow these instructions exactly.

FILE TO CREATE: src/renderer/hooks/useTasks.ts

Same pattern as useProjects but for tasks:

1. useTasks(projectId: string): { tasks, loading, error, refresh }
   - window.api.tasks.list(projectId)

2. useTask(projectId: string, taskId: string): { task, loading, error, refresh }
   - window.api.tasks.get(projectId, taskId)

3. useCreateTask(): { create: (projectId, data) => Promise, loading, error }
   - window.api.tasks.create

4. useUpdateTask(): { update: (projectId, taskId, data) => Promise, loading, error }
   - window.api.tasks.update

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## H4: `src/renderer/hooks/useRuns.ts` → Flash

```
You are a code writer. Follow these instructions exactly.

FILE TO CREATE: src/renderer/hooks/useRuns.ts

1. useRuns(projectId: string): { runs, loading, error, refresh }
   - window.api.runs.list(projectId)

2. useRun(projectId: string, runId: string): { run, loading, error, refresh }
   - window.api.runs.get(projectId, runId)

3. useImportRun(): { importRun: (projectId, folderPath) => Promise, loading, error }
   - window.api.runs.import

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## H5: `src/renderer/hooks/useKnowledge.ts` → Flash

```
You are a code writer. Follow these instructions exactly.

FILE TO CREATE: src/renderer/hooks/useKnowledge.ts

1. useDocs(projectId: string): { docs, loading, error, refresh }
   - window.api.knowledge.listDocs(projectId)

2. useDoc(projectId: string, docId: string): { doc, loading, error, refresh }
   - window.api.knowledge.getDoc(projectId, docId)

3. useSolvedIssues(projectId: string): { solvedIssues, loading, error, refresh }
   - window.api.knowledge.listSolved(projectId)

4. useAnchors(projectId: string): { anchors, loading, error, refresh }
   - window.api.knowledge.listAnchors(projectId)

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## ST1: `src/renderer/stores/app.store.ts` → Haiku

```
You are a code writer. Follow these instructions exactly.

TECH STACK: Zustand, TypeScript

FILE TO CREATE: src/renderer/stores/app.store.ts

IMPORTS:
- { create } from 'zustand'

Create a Zustand store with these slices:

interface AppState {
  // Current navigation context
  activeProjectId: string | null;
  activeTaskId: string | null;

  // Decision anchor gate
  anchorGateOpen: boolean;
  anchorGateTaskId: string | null;

  // UI state
  sidebarCollapsed: boolean;

  // Actions
  setActiveProject: (projectId: string | null) => void;
  setActiveTask: (taskId: string | null) => void;
  openAnchorGate: (taskId: string) => void;
  closeAnchorGate: () => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeProjectId: null,
  activeTaskId: null,
  anchorGateOpen: false,
  anchorGateTaskId: null,
  sidebarCollapsed: false,
  setActiveProject: (projectId) => set({ activeProjectId: projectId }),
  setActiveTask: (taskId) => set({ activeTaskId: taskId }),
  openAnchorGate: (taskId) => set({ anchorGateOpen: true, anchorGateTaskId: taskId }),
  closeAnchorGate: () => set({ anchorGateOpen: false, anchorGateTaskId: null }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));

DOES NOT:
- Fetch data (hooks do that)
- Use localStorage
- Persist state across app restarts

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## STEP 4 REVIEW — PASTE INTO SMART AI

```
Review these 6 hook/store files. Check:

1. Do all hooks reference the correct window.api method names (must match preload/api.ts)?
2. Does useIPC handle the { error, data } / { error, message } response pattern from IPC handlers?
3. Does useIPCQuery auto-fetch on mount and cleanup properly?
4. Does the Zustand store have all the state the modals need (anchor gate)?
5. Any missing TypeScript types or any 'any' that should be typed?

Output: issues with fixes, or "HOOKS AND STORE APPROVED."

{PASTE ALL 6 FILES HERE}
```
