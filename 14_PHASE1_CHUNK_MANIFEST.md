# Phase 1 Chunk Manifest — Exact Build Order

Every line below is one cheap-coder prompt producing one file. Smart brain writes the foundation first, then cheap coders build on it in the order listed.

## Foundation — Smart Brain Writes Directly

These are too important to delegate. The smart brain writes them first because everything else depends on them.

| # | File | Why smart brain |
|---|------|----------------|
| F1 | `package.json` | Defines all dependencies — cheap coders can't hallucinate imports |
| F2 | `tsconfig.json` | Compiler settings everything depends on |
| F3 | `electron-builder.json` | Build config |
| F4 | `tailwind.config.js` | Theme and styling foundation |
| F5 | `src/main/index.ts` | Electron app entry — security-critical |
| F6 | `src/preload/preload.ts` | Context bridge — security-critical |
| F7 | `src/preload/api.ts` | Exposed IPC API shape — defines the contract |
| F8 | `src/renderer/App.tsx` | Root component with router |
| F9 | `src/renderer/router.tsx` | All routes defined |
| F10 | `src/main/storage/file-store.ts` | Core file I/O — everything reads/writes through this |
| F11 | `src/main/storage/schema-validator.ts` | JSON schema validation |

**After foundation: copy all JSON schemas from architecture pack into `src/main/schemas/`**

## Types — Smart Brain Writes Directly

Types ARE the spec. They must be perfect.

| # | File | Entities |
|---|------|----------|
| T1 | `src/main/types/project.types.ts` | Project, Repository |
| T2 | `src/main/types/task.types.ts` | Task, TaskSize, TaskStatus |
| T3 | `src/main/types/run.types.ts` | Run, RunStatus, JobResult, ChangedFile |
| T4 | `src/main/types/knowledge.types.ts` | SourceDocument, CheatSheet, TrustLevel |
| T5 | `src/main/types/agent.types.ts` | AgentDefinition, AgentMode |
| T6 | `src/main/types/anchor.types.ts` | DecisionAnchor, AnchorStatus |
| T7 | `src/main/types/closure.types.ts` | ClosureRecord, TaskSize closure rules |
| T8 | `src/main/types/conflict.types.ts` | ConflictRecord, ConflictResolution |
| T9 | `src/main/types/prompt.types.ts` | PromptProfile, PromptStack |
| T10 | `src/main/types/common.types.ts` | Shared enums, ID types, timestamps |

## Batch 1 — Services (cheap coder, one prompt each)

Build order matters: lower-level services first, higher-level services depend on them.

| # | File | Model | Depends on |
|---|------|-------|------------|
| S1 | `src/main/services/project.service.ts` | Codestral | file-store, project.types |
| S2 | `src/main/services/task.service.ts` | Codestral | file-store, task.types, project.service |
| S3 | `src/main/services/knowledge.service.ts` | Codestral | file-store, knowledge.types |
| S4 | `src/main/services/run-importer.service.ts` | Codestral | file-store, schema-validator, run.types, knowledge.service |
| S5 | `src/main/services/prompt-compiler.service.ts` | Haiku | file-store, prompt.types, agent.types |
| S6 | `src/main/services/closure.service.ts` | Haiku | file-store, closure.types, task.service |
| S7 | `src/main/services/conflict.service.ts` | Haiku | file-store, conflict.types, knowledge.service |
| S8 | `src/main/services/watcher.service.ts` | Codestral | Node.js fs.watch, run-importer.service |
| S9 | `src/main/services/obsidian-bridge.service.ts` | Codestral | file-store, knowledge.types |

**Smart brain review checkpoint**: review all 9 services together before proceeding. Check: do they all use file-store consistently? Do types match?

## Batch 2 — IPC Handlers (cheap coder, one prompt each)

Each IPC handler is a thin layer: validate input, call service, return result.

| # | File | Model | Calls |
|---|------|-------|-------|
| I1 | `src/main/ipc/projects.ipc.ts` | Flash | project.service |
| I2 | `src/main/ipc/tasks.ipc.ts` | Flash | task.service |
| I3 | `src/main/ipc/runs.ipc.ts` | Flash | run-importer.service |
| I4 | `src/main/ipc/knowledge.ipc.ts` | Flash | knowledge.service |
| I5 | `src/main/ipc/prompts.ipc.ts` | Flash | prompt-compiler.service |
| I6 | `src/main/ipc/settings.ipc.ts` | Flash | file-store (direct) |

**Smart brain review checkpoint**: review all IPC handlers. Check: channel names consistent with preload/api.ts?

## Batch 3 — React Hooks (cheap coder, one prompt each)

Hooks wrap IPC calls for the renderer.

| # | File | Model | Wraps |
|---|------|-------|-------|
| H1 | `src/renderer/hooks/useIPC.ts` | Haiku | Generic IPC invocation hook |
| H2 | `src/renderer/hooks/useProjects.ts` | Flash | projects.ipc channels |
| H3 | `src/renderer/hooks/useTasks.ts` | Flash | tasks.ipc channels |
| H4 | `src/renderer/hooks/useRuns.ts` | Flash | runs.ipc channels |
| H5 | `src/renderer/hooks/useKnowledge.ts` | Flash | knowledge.ipc channels |

## Batch 4 — Common Components (cheap coder, one prompt each)

Small reusable components. No business logic.

| # | File | Model | Description |
|---|------|-------|-------------|
| C1 | `src/renderer/components/common/StatusPicker.tsx` | Flash | Dropdown for task/anchor status |
| C2 | `src/renderer/components/common/ConfirmButton.tsx` | Flash | Button with confirmation state |
| C3 | `src/renderer/components/common/SearchBar.tsx` | Flash | Text input with search icon |
| C4 | `src/renderer/components/layout/Sidebar.tsx` | Flash | Navigation sidebar |
| C5 | `src/renderer/components/layout/Header.tsx` | Flash | Top bar with breadcrumbs |
| C6 | `src/renderer/components/layout/HealthBadge.tsx` | Flash | Green/yellow/red badge |

## Batch 5 — Domain Components (cheap coder, one prompt each)

| # | File | Model | Description |
|---|------|-------|-------------|
| D1 | `src/renderer/components/tasks/TaskCard.tsx` | Flash | Task summary card for board |
| D2 | `src/renderer/components/tasks/TaskDetail.tsx` | Flash | Full task view panel |
| D3 | `src/renderer/components/tasks/SizeSelector.tsx` | Flash | Micro/Standard/Major picker |
| D4 | `src/renderer/components/runs/RunCard.tsx` | Flash | Run summary card |
| D5 | `src/renderer/components/runs/ArtifactViewer.tsx` | Flash | View artifact contents |
| D6 | `src/renderer/components/knowledge/DocCard.tsx` | Flash | Doc card with stale indicator |
| D7 | `src/renderer/components/knowledge/FreshnessIndicator.tsx` | Flash | Stale/fresh visual indicator |
| D8 | `src/renderer/components/knowledge/ConflictPanel.tsx` | Flash | Side-by-side conflict view |
| D9 | `src/renderer/components/prompts/PromptPreview.tsx` | Flash | Compiled prompt viewer |
| D10 | `src/renderer/components/prompts/ArtifactTailBlock.tsx` | Flash | Artifact tail display |

## Batch 6 — Modal Components (cheap coder, one prompt each)

| # | File | Model | Description |
|---|------|-------|-------------|
| M1 | `src/renderer/components/modals/DecisionAnchorGate.tsx` | Haiku | Hard-block modal with status picker |
| M2 | `src/renderer/components/modals/ClosureModal.tsx` | Haiku | Size-gated closure form |
| M3 | `src/renderer/components/modals/ConflictResolutionModal.tsx` | Haiku | Conflict resolution picker |

## Batch 7 — Pages (cheap coder, one prompt each)

Pages compose components. Each page gets a detailed wireframe in its prompt.

| # | File | Model | Screen |
|---|------|-------|--------|
| P1 | `src/renderer/pages/Dashboard.tsx` | Flash | Workspace dashboard with health badges |
| P2 | `src/renderer/pages/Projects.tsx` | Flash | Project list |
| P3 | `src/renderer/pages/ProjectDetail.tsx` | Flash | Project detail with tabs |
| P4 | `src/renderer/pages/TaskBoard.tsx` | Flash | Kanban + list views |
| P5 | `src/renderer/pages/PromptBuilder.tsx` | Haiku | Prompt compilation UI |
| P6 | `src/renderer/pages/RunImporter.tsx` | Flash | Import and validate runs |
| P7 | `src/renderer/pages/ReviewPanel.tsx` | Haiku | Review artifacts and approve/reject |
| P8 | `src/renderer/pages/KnowledgeCenter.tsx` | Flash | Source docs, cheat sheets, solved issues |
| P9 | `src/renderer/pages/AgentLibrary.tsx` | Flash | Agent definitions |
| P10 | `src/renderer/pages/Settings.tsx` | Flash | App settings |

## Batch 8 — Store (cheap coder, one prompt)

| # | File | Model | Description |
|---|------|-------|-------------|
| ST1 | `src/renderer/stores/app.store.ts` | Haiku | Zustand store with all slices |

## Summary

| Category | Smart brain | Cheap coder | Total files |
|----------|------------|-------------|-------------|
| Foundation | 11 | 0 | 11 |
| Types | 10 | 0 | 10 |
| Services | 0 (review only) | 9 | 9 |
| IPC | 0 (review only) | 6 | 6 |
| Hooks | 0 (review only) | 5 | 5 |
| Components | 0 (review only) | 19 | 19 |
| Pages | 0 (review only) | 10 | 10 |
| Store | 0 (review only) | 1 | 1 |
| **Total** | **21** | **50** | **71** |

Smart brain writes 21 critical files + reviews all 50 cheap coder outputs.
Cheap coders write 50 files at ~$0.002 each = ~$0.10 total.
Smart brain review cost: ~50 review calls at ~$0.03 each = ~$1.50.

**Total Phase 1 estimated cost: $2-4**
