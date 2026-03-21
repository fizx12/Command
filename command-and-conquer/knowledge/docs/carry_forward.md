# CARRY FORWARD — Initial Bootstrap

## Current State
The codebase is clearly an Electron desktop control plane for AI-assisted project/task/run orchestration, with a React renderer and file-backed workspace persistence. The strongest confirmed pieces are the build/config setup, the documented user workflow, and the workspace artifact conventions.

What looks solid:
- Electron + React + TypeScript project structure is established
- Renderer build pipeline is conventional and clean
- Tailwind theming is configured
- Manual QA expectations are unusually detailed in `TEST_WALKTHROUGH.md`
- Workspace-backed task/run model is consistent across planner docs, walkthrough docs, and sample workspace files
- Existing task update/delete IPC already exists, so the app is beyond pure scaffolding

- **COMPLETED**: Task UX reaches target stability:
  - Reopen existing tasks via unified TaskEdit form
  - Bidirectional navigation between Board and Prompt Generator with work-in-progress state preservation
  - Consistent visibility for delete actions everywhere tasks appear
  - Safe post-save/post-delete refresh behavior

## Watch Out For
- **Filesystem is the real database**
  - Do not treat in-memory renderer state as authoritative
  - Always assume refresh/reload from workspace after mutations
- **Prompt flow has side effects**
  - Prompt dispatch intentionally marks tasks `active`
  - Easy place to accidentally regress behavior during UI refactors
- **Task deletion is destructive**
  - It removes file-backed task folders and may orphan runs
  - Confirmation UX is not optional
- **State drift is a known problem area**
  - Planner notes explicitly call out drift between board state, selected task state, and prompt-builder selection
- **Contracts have evolved over time**
  - Older prompt templates in workspace use slightly different artifact instructions than newer ones
  - Be careful when changing importer assumptions
- **Strict TS, but lint is permissive in places**
  - `strict: true` is on, but ESLint allows `any`
  - Type discipline depends more on engineering behavior than lint enforcement
- **Packaging assumes built output layout**
  - Main entry must remain compatible with `dist/main/index.js`
  - Renderer build must continue landing under `dist/renderer`

## Suggested First Tasks
1. **Read the actual source files for main, preload, and renderer task flow**
   - Highest value missing context right now
   - Prioritize:
     - `src/main/index.*`
     - preload bridge files
     - `src/renderer/hooks/useTasks.ts`
     - `src/renderer/pages/TaskBoard.tsx`
     - `src/renderer/pages/PromptBuilder.tsx`
     - `src/renderer/pages/ReviewPanel.tsx`

2. **Implement or verify the planned task UX improvements**
   - This is the clearest active workstream from `planner_output.md`
   - Focus on:
     - reopen existing tasks in field-entry form
     - visible delete actions everywhere tasks appear
     - safe post-save/post-delete refresh behavior
     - preserving prompt generation behavior

3. **Add a lightweight automated smoke test strategy**
   - Even a small importer/task-flow test layer would reduce regression risk
   - If full E2E is too much, start with schema validation and critical hook/unit coverage

4. **Audit run importer compatibility**
   - Compare current importer expectations against older and newer prompt artifact formats in workspace
   - Especially around required files and `task_id` / `run_id` handling

5. **Document the preload API surface**
   - A concise IPC contract doc would help future agents avoid guessing and duplicating logic

## Open Questions
1. What exact files implement the Electron main window creation, preload bridge, and IPC handlers?
2. How much of renderer state is in Zustand versus local component state?
3. Are project/task/run schemas validated at runtime with AJV, or are those dependencies only planned?
4. How does run import currently handle partial or malformed artifact sets?
5. Is `chokidar` already used for live workspace scanning, or is scanning still manual/button-driven?
6. Are there existing route/query-param conventions for deep-linking into task edit mode, or is that still to be introduced?
7. What source file currently owns the canonical task lifecycle transitions?