# CODE HISTORY

## v1.0.0 Refactor Task Editing

### Summary
Unified task editing, added Prompt Generator state persistence, and enabled returning to generator.

### Snapshot: Unified TaskEdit Form
- **Component**: `TaskEdit.tsx`
- **Logic**: Unified `onSave` logic to handle both create and update.
- **Feature**: Added "AI Fill" capability.

### Snapshot: Prompt Generator State Persistence
- **Utility**: `revisionUtils.ts`
- **Mechanism**: `sessionStorage.setItem('prompt-builder-state', ...)`
- **Integration**: `PromptGenerator` calls `savePromptState` in `persistStateBeforeNav`.
