# SOURCE OF TRUTH INDEX

## Key Files
- `.eslintrc.json` — ESLint baseline for the TypeScript codebase; allows `any`, warns on unused TS vars
- `package.json` — top-level dependency and script authority; defines dev/build/start/lint workflow and confirms Electron + React + Zustand stack
- `vite.config.ts` — renderer build entry and alias config; sets renderer root to `src/renderer`, dev server port `5178`, and build output to `dist/renderer`
- `tsconfig.json` — shared TypeScript baseline and path aliases for main/renderer/preload
- `tsconfig.main.json` — main/preload compilation contract; CommonJS output to `dist`, root `src`
- `tsconfig.renderer.json` — renderer TypeScript contract; strict, no emit, React JSX
- `electron-builder.json` — packaging contract for desktop distribution; Windows NSIS target, packaged from `dist/**/*`
- `tailwind.config.js` — renderer styling tokens and content scan paths; defines semantic dark-theme colors and badge colors
- `postcss.config.js` — Tailwind + Autoprefixer integration
- `planner_output.md` — current implementation intent for task editing/deletion UX; best available map of renderer files under active change
- `TEST_WALKTHROUGH.md` — end-to-end behavioral source of truth for expected user flows: project creation, task creation, prompt compilation, run import, and review
- `src/renderer/hooks/useTasks.ts` — per planner notes, owns renderer-side task action helpers and refresh plumbing
- `src/renderer/pages/TaskBoard.tsx` — per planner notes, primary task board and task field-entry surface
- `src/renderer/pages/PromptBuilder.tsx` — per planner notes, owns prompt compilation flow and task selection behavior
- `src/renderer/pages/ReviewPanel.tsx` — per planner notes, owns review-stage task interaction behavior
- `src/renderer/components/common/ConfirmButton.tsx` — per planner notes, shared confirmation UX for destructive actions
- `workspace/projects/{projectId}/tasks/{taskId}/task_spec.json` — canonical persisted task record
- `workspace/projects/{projectId}/runs/{runId}/job_result.json` — canonical imported run summary/status record
- `workspace/projects/{projectId}/runs/{runId}/changed_files.json` — canonical changed-file manifest for review
- `workspace/projects/{projectId}/runs/{runId}/review_checklist.json` — canonical reviewer checklist input
- `workspace/projects/{projectId}/runs/{runId}/job_summary.md` — human-readable run summary artifact
- `workspace/projects/{projectId}/runs/{runId}/code_snippets.md` — human-readable code excerpt artifact
- `workspace/projects/proj-fishing/tasks/...` — examples of real task specs, prompts, and carry-forward docs showing how the workspace model is used in practice

## Data Flow
1. **User interacts in renderer**
   - React pages and hooks drive project/task/prompt/review UI
   - Zustand is present as the likely client-side state layer
2. **Renderer calls preload API**
   - Planner notes explicitly mention `window.api` usage and existing IPC channels like `tasks:update` and `tasks:delete`
3. **Preload mediates to main process**
   - Preload exposes safe APIs into the browser context
4. **Main process performs filesystem-backed operations**
   - Reads/writes task specs, scans run folders, imports artifacts, and likely watches workspace changes
5. **Workspace files become the durable source of truth**
   - JSON/MD artifacts are later re-read by prompt builder, run importer, and review UI
6. **Prompt builder emits external-AI instructions**
   - Compiled prompt includes exact output location and artifact requirements
7. **External AI writes run artifacts into workspace**
   - Files are created under `workspace/projects/{projectId}/runs/{runId}/`
8. **App scans/imports those artifacts**
   - Run importer reads artifact files, auto-links to tasks when `task_id` is present, and sends the run into review flow
9. **Review updates task/run lifecycle**
   - Review panel allows approval/revision/rejection and should keep task state actionable

Important observed data contracts:

- Task specs are JSON with fields like:
  - `id`, `projectId`, `title`, `description`, `size`, `status`, `scope`, `outOfScope`, `mustPreserve`, `linkedRunIds`, timestamps
- Run artifacts are expected to include:
  - `job_result.json`
  - `changed_files.json`
  - `review_checklist.json`
  - `job_summary.md`
  - `code_snippets.md`
- Prompt generation depends on task specs being schema-safe and immediately readable after edits

## State Management
- **Renderer state**
  - Zustand is installed and likely used for app/project/task selection state
  - Planner notes suggest task state currently spans multiple local sources of truth and needs synchronization after save/delete
- **Persistent state**
  - The real durable state is the workspace filesystem, not browser memory
  - Task folders and run folders are the authoritative records
- **Mutation pattern**
  - Renderer should use centralized helpers like `useTasks.ts`
  - Mutations should go through preload/main IPC rather than ad hoc direct calls
- **Refresh pattern**
  - After create/update/delete/import actions, UI should refresh from persisted state to avoid drift
- **Lifecycle state**
  - Task status progression is meaningful and part of product logic, not just display metadata

## Entry Points
- `package.json -> main: dist/main/index.js` — Electron app runtime entry after build
- `npm run dev` — concurrent main TypeScript watch + Vite renderer dev server
- `npm run dev:main` — watches and compiles `src/main/**/*` and `src/preload/**/*`
- `npm run dev:renderer` — starts Vite for the renderer rooted at `src/renderer`
- `npm run build` — builds main/preload with TypeScript and renderer with Vite
- `npm run start` — launches Electron against `dist/main/index.js`
- `src/renderer/index.html` — renderer HTML entry referenced by Vite/Tailwind config
- `src/main/index.ts` or equivalent compiled to `dist/main/index.js` — implied Electron main-process bootstrap
- `src/preload/**/*` — implied preload bridge entry compiled with main process code
- `src/renderer/**/*` — React SPA entry tree, with route/page ownership implied by planner docs:
  - Task board
  - Prompt builder
  - Review panel
  - likely project/runs/dashboard views referenced in `TEST_WALKTHROUGH.md`