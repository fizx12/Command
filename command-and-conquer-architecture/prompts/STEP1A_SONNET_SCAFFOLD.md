# STEP 1A — PASTE THIS INTO SONNET (Claude Sonnet via Cursor/Claude Code/IDE)

## ⚠️ FIRST: Paste the contents of CONTEXT_BUNDLE.md above this line before sending.

You are building the Electron + React foundation for Command and Conquer. The context bundle above describes the full system, file structure, data storage layout, IPC pattern, and all key concepts. Read it carefully — every file you create must fit into that structure.

## YOUR JOB

Write the 12 foundation files listed below. These files define the project scaffold, build config, Electron entry point, preload security bridge, React shell, and core storage layer. Every other file in the app (50+ more files) will depend on these, so they must be correct.

## TECH STACK (from context bundle)

- Electron 28+
- React 18 with TypeScript (strict mode)
- Tailwind CSS 3
- Zustand for state management
- React Router v6 (HashRouter for Electron compatibility)
- Node.js fs/path for file I/O
- Ajv + ajv-formats for JSON schema validation
- chokidar for file watching
- Vite for renderer bundling

## FILES TO PRODUCE

Create all 11 files below with complete, working code. No placeholders, no TODOs.

---

### F1: `package.json`

```json
{
  "name": "command-and-conquer",
  "version": "0.1.0",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:main\" \"npm run dev:renderer\"",
    "dev:main": "tsc -p tsconfig.main.json --watch",
    "dev:renderer": "vite",
    "build": "tsc -p tsconfig.main.json && vite build",
    "start": "electron dist/main/index.js",
    "lint": "eslint src/ --ext .ts,.tsx"
  }
}
```

Include these exact dependencies (use latest stable versions):
- electron, electron-builder
- react, react-dom, react-router-dom
- zustand
- tailwindcss, postcss, autoprefixer
- typescript, @types/react, @types/react-dom, @types/node
- ajv (JSON schema validator)
- chokidar (file watcher)
- vite, @vitejs/plugin-react
- concurrently
- eslint, @typescript-eslint/parser, @typescript-eslint/eslint-plugin

No other dependencies. Do not add anything not listed.

---

### F2: `tsconfig.json`

Root tsconfig. Strict mode. Paths alias `@main/*` to `src/main/*` and `@renderer/*` to `src/renderer/*`.

Also create:
- `tsconfig.main.json` — extends root, includes `src/main/**/*` and `src/preload/**/*`, outputs to `dist/main/`
- `tsconfig.renderer.json` — extends root, includes `src/renderer/**/*`, used by Vite

---

### F3: `electron-builder.json`

Basic config for building on Windows. App name "Command and Conquer". Output to `release/`. Include the `dist/` folder.

---

### F4: `tailwind.config.js`

Content paths: `src/renderer/**/*.{tsx,ts}`. Default theme with these custom colors:
- `badge-green: '#22c55e'`
- `badge-yellow: '#eab308'`
- `badge-red: '#ef4444'`
- `surface: '#1e1e2e'`
- `surface-alt: '#2a2a3e'`
- `text-primary: '#e0e0e0'`
- `text-secondary: '#a0a0a0'`
- `accent: '#7c3aed'`

Dark theme by default.

Also create `postcss.config.js` and `src/renderer/index.css` with Tailwind directives.

---

### F5: `vite.config.ts`

Vite config for the renderer process. React plugin. Root is `src/renderer/`. Build output to `dist/renderer/`. Resolve alias `@renderer` to `src/renderer/`.

---

### F6: `src/main/index.ts`

Electron main process entry point:
- Create BrowserWindow (1200x800, dark background)
- Load `dist/renderer/index.html` in production, `http://localhost:5173` in dev
- Register all IPC handlers (import from `./ipc/` — for now just create the import structure, handlers will be added later)
- Set up CSP headers
- Handle app ready, window-all-closed, activate events

---

### F7: `src/preload/preload.ts`

Electron preload script using contextBridge:
- Expose an `api` object on `window`
- The api object has methods for each IPC domain:

```typescript
window.api = {
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    get: (id: string) => ipcRenderer.invoke('projects:get', id),
    create: (data: CreateProjectInput) => ipcRenderer.invoke('projects:create', data),
    update: (id: string, data: UpdateProjectInput) => ipcRenderer.invoke('projects:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id),
  },
  tasks: {
    list: (projectId: string) => ipcRenderer.invoke('tasks:list', projectId),
    get: (projectId: string, taskId: string) => ipcRenderer.invoke('tasks:get', projectId, taskId),
    create: (projectId: string, data: CreateTaskInput) => ipcRenderer.invoke('tasks:create', projectId, data),
    update: (projectId: string, taskId: string, data: UpdateTaskInput) => ipcRenderer.invoke('tasks:update', projectId, taskId, data),
  },
  runs: {
    list: (projectId: string) => ipcRenderer.invoke('runs:list', projectId),
    get: (projectId: string, runId: string) => ipcRenderer.invoke('runs:get', projectId, runId),
    import: (projectId: string, folderPath: string) => ipcRenderer.invoke('runs:import', projectId, folderPath),
  },
  knowledge: {
    listDocs: (projectId: string) => ipcRenderer.invoke('knowledge:listDocs', projectId),
    getDoc: (projectId: string, docId: string) => ipcRenderer.invoke('knowledge:getDoc', projectId, docId),
    listSolved: (projectId: string) => ipcRenderer.invoke('knowledge:listSolved', projectId),
    listAnchors: (projectId: string) => ipcRenderer.invoke('knowledge:listAnchors', projectId),
  },
  prompts: {
    compile: (projectId: string, taskId: string, agentId: string) => ipcRenderer.invoke('prompts:compile', projectId, taskId, agentId),
    preview: (projectId: string, taskId: string, agentId: string) => ipcRenderer.invoke('prompts:preview', projectId, taskId, agentId),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (data: any) => ipcRenderer.invoke('settings:update', data),
    selectFolder: () => ipcRenderer.invoke('settings:selectFolder'),
  },
  system: {
    getHealth: (projectId: string) => ipcRenderer.invoke('system:getHealth', projectId),
  }
}
```

---

### F8: `src/preload/api.ts`

TypeScript type declarations for the `window.api` object exposed by the preload script. Export the `ElectronAPI` interface so the renderer can import it.

---

### F9: `src/renderer/main.tsx`

React entry point. Renders `<App />` into `#root`. Import index.css.

Also create `src/renderer/index.html` with a `<div id="root">`.

---

### F10: `src/renderer/App.tsx`

Root React component:
- Wraps everything in React Router `<BrowserRouter>` (use `<HashRouter>` for Electron compatibility)
- Layout: sidebar on left, main content area on right
- Routes (all render placeholder `<div>Page Name</div>` for now):
  - `/` → Dashboard
  - `/projects` → Projects
  - `/projects/:projectId` → ProjectDetail
  - `/projects/:projectId/tasks` → TaskBoard
  - `/projects/:projectId/prompt-builder` → PromptBuilder
  - `/projects/:projectId/runs` → RunImporter
  - `/projects/:projectId/review/:taskId` → ReviewPanel
  - `/projects/:projectId/knowledge` → KnowledgeCenter
  - `/projects/:projectId/agents` → AgentLibrary
  - `/settings` → Settings

---

### F11: `src/main/storage/file-store.ts`

The core file I/O module. Every service reads/writes through this. Methods:

```typescript
export class FileStore {
  constructor(private basePath: string) {}

  // Read a JSON file, parse it, return typed result
  async readJSON<T>(relativePath: string): Promise<T>

  // Write an object as formatted JSON
  async writeJSON<T>(relativePath: string, data: T): Promise<void>

  // Read a markdown file as string
  async readMarkdown(relativePath: string): Promise<string>

  // Write a string as markdown
  async writeMarkdown(relativePath: string, content: string): Promise<void>

  // List all items in a directory (returns folder names for entity listings)
  async listDirectories(relativePath: string): Promise<string[]>

  // List all files in a directory matching a glob
  async listFiles(relativePath: string, pattern?: string): Promise<string[]>

  // Check if a path exists
  async exists(relativePath: string): Promise<boolean>

  // Create a directory (recursive)
  async ensureDir(relativePath: string): Promise<void>

  // Delete a file or directory
  async remove(relativePath: string): Promise<void>

  // Copy a file
  async copy(from: string, to: string): Promise<void>

  // Get absolute path from relative
  resolvePath(relativePath: string): string
}
```

Use Node.js `fs/promises` and `path`. Handle errors gracefully — return null or empty arrays for missing files, throw for write failures. Create parent directories automatically on write.

---

### F12: `src/main/storage/schema-validator.ts`

JSON Schema validator using Ajv:

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export class SchemaValidator {
  private ajv: Ajv;

  constructor(schemasDir: string)
  // Load all .schema.json files from schemasDir on construction

  validate(schemaName: string, data: unknown): { valid: boolean; errors: string[] }
}
```

Schema names map to files: `'job_result'` → `job_result.schema.json`, etc.

---

## RULES

1. Write complete, working code for every file. No `// TODO` comments. No placeholder implementations.
2. Use the exact file paths specified.
3. Do not add files not listed above.
4. Do not add dependencies not listed in F1.
5. Use TypeScript strict mode everywhere.
6. All Electron IPC must go through the preload contextBridge — no nodeIntegration.
7. Use async/await for all file operations.
8. Add JSDoc comments on exported functions/classes only. No inline comments unless logic is non-obvious.

## OUTPUT FORMAT

For each file, output it as:

```
=== FILE: {path} ===
```

Then the complete file contents. This makes it easy to split into separate files.
