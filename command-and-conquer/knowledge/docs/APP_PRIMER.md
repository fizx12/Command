# APP PRIMER — Command and Conquer

## What This Is
Command and Conquer is an Electron desktop application for orchestrating AI-assisted software work across projects, tasks, prompts, runs, and review flows. The visible stack from the provided files is Electron for the desktop shell, React for the renderer UI, TypeScript across main/preload/renderer, Vite for renderer bundling, Tailwind CSS for styling, Zustand for client-side state, and file-backed workspace storage under `workspace/projects/...`.

The app appears to manage a human-in-the-loop workflow where users create projects and tasks, compile prompts for external AI tools, import generated run artifacts, and review/approve results. The workspace folder is not incidental; it is part of the product contract and stores task specs, prompts, run artifacts, and carry-forward knowledge.

## Core Architecture
The system is split into the standard Electron layers:

- **Main process**
  - Compiled with `tsc -p tsconfig.main.json`
  - Output goes to `dist/main`
  - Owns Node/Electron capabilities, filesystem access, and likely IPC handlers for project/task/run operations
- **Preload layer**
  - Also compiled by `tsc -p tsconfig.main.json`
  - Likely exposes a safe `window.api` bridge to the renderer
  - Planner notes explicitly reference existing IPC channels like `tasks:update` and `tasks:delete`
- **Renderer**
  - React app built by Vite from `src/renderer`
  - Uses React Router for navigation and Zustand for state
  - Tailwind-based UI with a dark theme palette defined in `tailwind.config.js`

The app is also structured around a **workspace-backed domain model**:

- Projects live under `workspace/projects/{projectId}/`
- Tasks are file-backed, with an important canonical path:
  - `workspace/projects/{projectId}/tasks/{taskId}/task_spec.json`
- Runs live under:
  - `workspace/projects/{projectId}/runs/{runId}/`
- Knowledge and carry-forward docs are expected to be written into workspace folders and then reused in future prompt generation

The provided planner output gives a useful renderer ownership map for current task UX:

- `src/renderer/hooks/useTasks.ts` — renderer task CRUD helpers
- `src/renderer/pages/TaskBoard.tsx` — task field-entry and board UI
- `src/renderer/pages/PromptBuilder.tsx` — prompt compilation and task selection
- `src/renderer/pages/ReviewPanel.tsx` — review surface for imported runs
- `src/renderer/components/common/ConfirmButton.tsx` — shared destructive-action confirmation UI

## Key Patterns
- **File-backed persistence, not database-first**
  - The strongest observable pattern is that tasks and runs are persisted as files/folders in the workspace
  - JSON and markdown artifacts are first-class system inputs, not just logs
- **IPC-mediated renderer mutations**
  - Renderer should not directly own persistence logic
  - Planner notes indicate task update/delete already exist in IPC/preload and should be reused rather than bypassed
- **Prompt-driven workflow**
  - Prompt compilation is a core product feature, not an auxiliary tool
  - Prompt generation intentionally changes task lifecycle state, specifically marking tasks `active` when prompts are dispatched
- **Strict TypeScript baseline**
  - `strict: true` is enabled in root and renderer configs
  - Main and preload compile separately from renderer
- **Path aliasing**
  - Shared aliases exist for `@main/*`, `@renderer/*`, and `@preload/*`
  - Vite currently resolves `@renderer`
- **Dark themed Tailwind UI**
  - Custom semantic colors like `surface`, `surface-alt`, `text-primary`, `text-secondary`, and `accent`
  - Badge colors are part of the visual language and referenced in testing docs
- **Low-test / manual verification culture right now**
  - No automated test framework is present in `package.json`
  - Existing guidance emphasizes lint, build, and end-to-end manual walkthroughs

## Critical Invariants
- **Workspace path contracts must remain stable**
  - Tasks are expected at `workspace/projects/{projectId}/tasks/{taskId}/task_spec.json`
  - Runs are expected at `workspace/projects/{projectId}/runs/{runId}/`
  - Prompt and artifact import flows depend on these paths
- **Task lifecycle semantics must not regress**
  - Planner output states the lifecycle invariant as:
    `backlog → active → blocked → review → approved → done → archived`
- **Prompt dispatch marks tasks active**
  - This is explicitly called out as intentional behavior and must be preserved
- **Renderer should stay synchronized after mutations**
  - Planner notes warn about drift between task list state, selected task state, and prompt-builder selection
- **Deletion is destructive and file-backed**
  - Deleting a task removes a folder, not just in-memory state
  - Confirmation UX is required
- **Run artifact schema matters**
  - Test walkthrough expects imported runs to contain specific files and fields:
    `job_result.json`, `changed_files.json`, `review_checklist.json`, `job_summary.md`, `code_snippets.md`
  - `task_id` and `run_id` are especially important for auto-linking
- **Knowledge docs are part of the system contract**
  - Prompt templates repeatedly instruct agents to maintain `APP_PRIMER.md`, `SOURCE_OF_TRUTH_INDEX.md`, and carry-forward docs
  - These are operational inputs for future agents, not optional documentation

## Current State
What is clearly present from the provided files:

- Electron + React + TypeScript app scaffold is in place
- Renderer uses Vite and Tailwind
- Linting is configured
- Packaging for Windows via `electron-builder` is configured
- The product workflow and manual QA expectations are well documented in `TEST_WALKTHROUGH.md`
- Task CRUD plumbing already exists in main/preload for update/delete, per planner notes
- There is an active implementation plan focused on improving task editing/deletion UX across renderer screens

What appears incomplete or still evolving:

- No automated tests are configured
- The actual source files for main/preload/renderer were not included here, so some architecture details remain inferred from config and planning docs
- Task UX is currently mid-iteration; planner output identifies editing existing tasks, returning to field-entry screens, and consistent deletion as active work
- Documentation quality is mixed: there is strong process documentation, but some workspace prompt artifacts are stale, duplicated, or project-specific to `proj-fishing`

Known issues / risks visible from the docs:

- UI state drift after task save/delete is a known risk
- Deleting active tasks can orphan run artifacts
- Current renderer task flow lacks automated coverage
- Some prompt artifacts in workspace show evolving system rules, suggesting contracts have changed over time and older runs may not match newest expectations