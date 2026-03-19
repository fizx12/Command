# CONTEXT BUNDLE — Prepend to every prompt that needs project awareness

## What is Command and Conquer?

An Electron + React desktop app that manages AI-assisted development across multiple projects. It tracks projects, repositories, tasks, agent roles, prompt compilation, run artifact imports, knowledge docs, and review/closure workflows. The coding tools (Cursor, Claude, Gemini, Antigravity) are external workers — this app is the orchestrator.

## Tech Stack

- Electron 28+ (main process: Node.js)
- React 18 + TypeScript strict mode (renderer process)
- Tailwind CSS 3 (dark theme, custom colors)
- Zustand (state management)
- React Router v6 (HashRouter for Electron)
- Ajv (JSON schema validation)
- chokidar (file watching)
- Vite (renderer bundler)

## Project File Structure

```
command-and-conquer/
  package.json
  tsconfig.json
  tsconfig.main.json
  tsconfig.renderer.json
  electron-builder.json
  tailwind.config.js
  postcss.config.js
  vite.config.ts
  src/
    main/                              # Electron main process (Node.js)
      index.ts                         # App entry, creates window, registers IPC
      types/                           # All TypeScript type definitions
        index.ts                       # Barrel export
        common.types.ts
        project.types.ts
        task.types.ts
        run.types.ts
        knowledge.types.ts
        agent.types.ts
        anchor.types.ts
        closure.types.ts
        conflict.types.ts
        prompt.types.ts
      storage/                         # File I/O layer
        file-store.ts                  # Read/write JSON and markdown files
        schema-validator.ts            # Validate JSON against schemas
      services/                        # Business logic (one file per domain)
        project.service.ts
        task.service.ts
        run-importer.service.ts
        knowledge.service.ts
        prompt-compiler.service.ts
        closure.service.ts
        conflict.service.ts
        watcher.service.ts
        obsidian-bridge.service.ts
      ipc/                             # IPC handlers (thin wrappers around services)
        index.ts                       # Barrel: registerAllHandlers()
        projects.ipc.ts
        tasks.ipc.ts
        runs.ipc.ts
        knowledge.ipc.ts
        prompts.ipc.ts
        settings.ipc.ts
      schemas/                         # JSON Schema files for artifact validation
        job_result.schema.json
        changed_files.schema.json
        review_checklist.schema.json
        decision_anchor.schema.json
        closure.schema.json
        conflict.schema.json
    renderer/                          # React UI (bundled by Vite)
      index.html
      main.tsx                         # React entry point
      index.css                        # Tailwind directives
      App.tsx                          # Root component with HashRouter
      router.tsx                       # Route definitions
      pages/                           # One file per screen
        Dashboard.tsx
        Projects.tsx
        ProjectDetail.tsx
        TaskBoard.tsx
        PromptBuilder.tsx
        RunImporter.tsx
        ReviewPanel.tsx
        KnowledgeCenter.tsx
        AgentLibrary.tsx
        Settings.tsx
      components/
        layout/
          Sidebar.tsx
          Header.tsx
          HealthBadge.tsx
        tasks/
          TaskCard.tsx
          TaskDetail.tsx
          SizeSelector.tsx
        runs/
          RunCard.tsx
          ArtifactViewer.tsx
        knowledge/
          DocCard.tsx
          FreshnessIndicator.tsx
          ConflictPanel.tsx
        prompts/
          PromptPreview.tsx
          ArtifactTailBlock.tsx
        modals/
          DecisionAnchorGate.tsx
          ClosureModal.tsx
          ConflictResolutionModal.tsx
        common/
          StatusPicker.tsx
          ConfirmButton.tsx
          SearchBar.tsx
      hooks/                           # IPC wrappers for React
        useIPC.ts
        useProjects.ts
        useTasks.ts
        useRuns.ts
        useKnowledge.ts
      stores/
        app.store.ts                   # Zustand store
    preload/                           # Electron preload (security bridge)
      preload.ts                       # contextBridge.exposeInMainWorld
      api.ts                           # TypeScript types for window.api
```

## Data Storage Layout (on user's disk)

The app reads/writes to two locations:

**Operational folder** (structured JSON + markdown):
```
CommandAndConquer/
  system/
    GLOBAL_RULES.md
    MASTER_PROMPT.md
    OUTPUT_FORMAT.md
    ARTIFACT_TAIL.md
    settings.json
  workspace/
    projects/
      {project-id}/
        overview/
          project.config.json
          repos/
            {repo-id}.json
        tasks/
          {TASK-id}/
            task_spec.json
            planner_output.md
            implementer_prompt.md
            closure.json
            decision_anchor.json
            carry_forward.md
        runs/
          {RUN-id}/
            job_result.json
            job_summary.md
            changed_files.json
            review_checklist.json
            code_snippets.md
            run.meta.json
        agents/
          {agent-id}.md
        knowledge/
          docs/
            {doc-id}.json
          cheat-sheets/
            {sheet-id}.json
          solved/
            {SOLVED-id}.json
        conflicts/
          {CONFLICT-id}.json
        conversations/
    global/
      GLOBAL_SOLVED_ISSUES.json
```

**Obsidian vault** (markdown for search/backlinks — write-only bridge):
```
ObsidianVault/CommandAndConquer/{project-id}/
  solved/{SOLVED-id}.md
  decisions/{ANCHOR-id}.md
  closures/{CLOSE-id}.md
```

## IPC Pattern

All renderer ↔ main communication goes through Electron IPC:
- Renderer calls `window.api.{domain}.{method}(args)`
- Preload bridges to `ipcRenderer.invoke('{domain}:{method}', args)`
- Main process handler calls the corresponding service method
- Returns `{ error: false, data: result }` or `{ error: true, message: string }`

## Tailwind Custom Colors

```
badge-green: '#22c55e'
badge-yellow: '#eab308'
badge-red: '#ef4444'
surface: '#1e1e2e'
surface-alt: '#2a2a3e'
text-primary: '#e0e0e0'
text-secondary: '#a0a0a0'
accent: '#7c3aed'
```

## Key Concepts

- **Task sizes**: Micro (quick fix, <30min), Standard (multi-file, 30min-half day), Major (architecture, >half day)
- **Task statuses**: backlog → active → blocked → review → approved → done → archived
- **Modes**: MAX (full context, expensive) and WeakSAUCE (minimal context, cheap)
- **Health badges**: green (all clear), yellow (stale docs or stuck reviews), red (yellow + unresolved conflicts)
- **Decision anchors**: hard-block classification at every task/session boundary (Solved/Broken/Unsolved/BugPatch/Update/DifficultProblemWithSolution)
- **Artifact tail**: mandatory instructions appended to every implementer prompt telling the coder what files to produce
- **Watch files**: glob patterns in doc frontmatter — when a run changes matching files, the doc is flagged stale
