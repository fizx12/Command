# Planner Output: Task Control

**Date:** 2026-03-18  
**Planner:** planner_max  
**Scope:** Enable editing existing tasks, allow returning to task field-entry screens after initial creation, preserve the prompt generation flow, and add deletion for every task.

## Summary

The current app already has task CRUD plumbing in the main process and preload layer, plus an inline create/edit form on the task board. The implementation work is therefore concentrated in the renderer: expose a reliable way to jump back to the field-entry form for any existing task, make deletion visible and consistent across task-facing screens, and keep prompt generation and in-progress task status behavior intact.

## File Impact Map

- `src/renderer/hooks/useTasks.ts` - Modify to add a first-class delete helper alongside the existing create/update hooks, so task actions are handled consistently from the renderer instead of ad hoc `window.api` calls. Risk: low.
- `src/renderer/pages/TaskBoard.tsx` - Modify as the primary task field-entry surface. Add a reliable edit-entry path for existing tasks, preserve create-to-prompt flow, and make delete affordances explicit and always accessible on task cards. Risk: high.
- `src/renderer/pages/PromptBuilder.tsx` - Modify so a task selected for prompt generation can be sent back to the field-entry form for editing and can be deleted without breaking the prompt workflow. Risk: high.
- `src/renderer/pages/ReviewPanel.tsx` - Modify so in-progress tasks can still be edited or deleted from the review surface instead of becoming trapped in review. Risk: high.
- `src/renderer/components/common/ConfirmButton.tsx` - Modify if the delete UX uses the shared confirmation component instead of ad hoc confirmation logic. Risk: low.

No main-process or preload API additions are expected because `tasks:update` and `tasks:delete` already exist.

## Implementation Steps

1. Decide on the edit-return mechanism and keep it simple: use a task-board deep link/query param that opens the existing field-entry form prefilled for a task, instead of adding a new route unless the current UI proves too brittle.
2. Add renderer-side task action helpers in `useTasks.ts`, including delete handling and any refresh plumbing needed after mutation.
3. Update `TaskBoard.tsx` so existing tasks can always be reopened in the field-entry form, including active tasks, while preserving the current create-then-prompt path.
4. Make task deletion explicit on the board, not hover-only, and ensure delete confirmation is clear because this is a destructive file-backed operation.
5. Update `PromptBuilder.tsx` so the selected task can jump back to edit mode, and so deletion from this screen returns the UI to a safe state without losing the prompt flow.
6. Update `ReviewPanel.tsx` so a task in review or active state can still be edited or deleted, and so the screen navigates back cleanly after mutation.
7. Wire post-save and post-delete refresh behavior so list state, selected task state, and prompt-builder selection do not drift out of sync.
8. Verify that editing an in-progress task does not reset the task into a stuck state and that prompt compilation/copy still marks tasks active as it does today.

## Decision Points

- Hard delete vs soft delete. Recommended default is hard delete because tasks are stored as separate folders and the current task model has no trash/recovery layer.
- Edit-return UX. Recommended default is a query-param deep link back to the existing task board form, but a dedicated editor route is still an option if the board becomes too stateful.
- Status on edit. Recommended default is to preserve the task’s current status, including `active`, unless the human wants all edits to reset status back to `backlog`.
- Deletion scope. Recommended default is to remove only the task folder and leave linked runs orphaned, since cascading cleanup would expand scope and risk.

## Risk Register

- Deleting an active task can orphan prompt/run artifacts and confuse downstream review flows. Likelihood: medium. Mitigation: require explicit confirmation and keep the deletion scope limited to the task folder unless cascade cleanup is explicitly approved.
- Edit state can drift from the prompt-builder selection if there are multiple local sources of truth. Likelihood: medium. Mitigation: keep one canonical edit identifier in the task board and refresh lists after save/delete.
- Active tasks may look “stuck” if editing resets status or clears prompt-builder state. Likelihood: medium. Mitigation: preserve task status during field edits and return users to the same task context after save.
- Delete actions hidden behind hover states may not satisfy the “every task” requirement. Likelihood: high. Mitigation: make delete actions persistent and visible wherever a task is surfaced for selection or inspection.
- There is no existing automated test coverage in the inspected renderer task flow. Likelihood: high. Mitigation: add focused smoke checks and run lint/build after implementation.

## Testing Strategy

- Run `npm run lint` after the renderer changes.
- Run `npm run build` to catch type errors and IPC/preload signature drift.
- Create a task, generate a prompt, and confirm the task still transitions to `active` exactly as it does today.
- Reopen a backlog task and an active task in the field-entry form, edit fields, save, and verify the task remains actionable.
- Delete a task from the board, from prompt-builder, and from review, then verify the task folder is removed and each UI recovers cleanly.
- Confirm the prompt-builder still compiles, copies, and refreshes the task list after an edit or delete.

## Carry-Forward Seeds

- Task data is file-backed per task folder at `workspace/projects/<projectId>/tasks/<taskId>/task_spec.json`.
- The prompt compiler reads task specs directly, so task edits must remain schema-safe and immediately visible to prompt generation.
- The lifecycle invariant must remain `backlog → active → blocked → review → approved → done → archived`.
- The current prompt generation flow intentionally marks a task `active` when the prompt is dispatched; this behavior must not regress.
- `tasks:update` and `tasks:delete` already exist in IPC/preload, so the work is about renderer wiring, navigation, and state synchronization.
- Reuse the shared confirmation component if possible so task deletion feels consistent across the app.
