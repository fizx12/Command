# Command and Conquer — Master Architecture

## 1. Purpose

Command and Conquer is a **multi-project AI development control plane**.

It manages:
- projects and repositories (multiple repos per project, one active at a time)
- agent roles and prompt profiles
- task specs with size classification (Micro / Standard / Major)
- run imports with schema-validated artifacts
- code-change summaries and review gates
- size-gated closure workflow with AI-drafted closure
- decision anchor gates (hard blocks at session/task boundaries)
- source-of-truth freshness via watch-file declarations
- cheat sheets and solved issue memory
- automatic conflict detection with manual resolution

It reduces:
- copy/paste prompt stitching
- repeated repo rereads
- stale documentation
- AI drift
- regression from weak scoping
- repeated solving of the same issue across projects

The coding tools are workers. Command and Conquer is the orchestrator.

## 2. Core principles

### 2.1 Files over chat memory
Agents communicate through structured files, not transcripts.

### 2.2 Durable memory
Every run creates persistent artifacts:
- machine-readable result (job_result.json)
- human-readable summary (job_summary.md)
- changed file list (changed_files.json)
- review checklist (review_checklist.json)
- code snippet history (code_snippets.md)
- review outcome
- closure notes with decision anchor

### 2.3 Explicit boundaries
Do not blur: planning, implementation, review, closure, truth maintenance.

### 2.4 Two modes only
- **MAX**: full-context, architecture-aware, higher token spend
- **WeakSAUCE**: minimal-context, highly targeted, low token spend

### 2.5 Anti-drift by design
The system actively prevents staleness via:
- watch-file declarations in doc frontmatter
- automatic staleness flagging on run import (file-overlap comparison)
- automatic conflict detection
- closure gates (size-gated)
- cheat-sheet invalidation
- solved issue reuse
- periodic re-audit

### 2.6 Decision anchors everywhere
The system forces decision recording at every session/task boundary. Hard block — you cannot proceed to a new task, project, or conversation without classifying the current work. Produces structured records that AI agents consume as context in future sessions.

## 3. Main system areas

### 3.1 Project registry
Tracks all projects and linked repositories. Multiple repos per project, one active at a time.

### 3.2 Agent library
Stores prescripted agent roles and behaviors.

### 3.3 Task system
Tracks work from backlog to closure. Tasks classified by size (Micro / Standard / Major) which determines closure requirements.

### 3.4 Run system
Ingests schema-validated artifacts from external AI coding tools. Auto-flags stale docs and detects conflicts on import.

### 3.5 Knowledge system
Split across two storage layers:
- **Obsidian vault** = knowledge layer (primers, cheat sheets, solved issues, decision log, source docs)
- **Local folders** = operational layer (tasks, runs, agents, conversations)
App bridges both — on closure, records written to both layers.

### 3.6 Prompt compilation system
Builds role-appropriate prompts from stable blocks plus task context. Every implementer prompt includes a mandatory artifact tail section.

### 3.7 Review and closure system
Size-gated: Micro tasks get near-zero-friction closure. Standard/Major tasks get AI-drafted closure that user reviews.

## 4. Top-level architecture

```txt
User
  -> Command and Conquer UI
      -> Decision Anchor Gate (session/task boundary interceptor)
      -> Project Context Layer (multi-repo, one active)
      -> Agent/Prompt Layer (with artifact tail auto-append)
      -> Task/Run Layer (size-gated lifecycle)
      -> Knowledge Layer (Obsidian vault + local folders)
      -> Review/Closure Layer (AI-drafted, size-gated)
      -> Run Importer (schema validation, stale/conflict detection)
      -> Repo/Tool Connectors
          -> Cursor / Claude Code / Gemini / Antigravity / others
```

## 5. External tool model

Command and Conquer does not depend on scraping chat UIs.

External tools must write structured run artifacts to disk or through a connector:
- `job_result.json`
- `job_summary.md`
- `changed_files.json`
- `review_checklist.json`
- `code_snippets.md`
- optional `git_diff.patch`

The artifact tail block in every implementer prompt tells the coder exactly what to produce. This is not optional — it is part of the agent's job.

## 6. Bilateral communication (Phase 4+)

Mechanisms for app-to-coder communication:
- **File-based bridge**: app writes instruction files to a watched folder, coder reads them; coder writes artifacts back. Works with any tool that can read/write files.
- **CLI bridge**: app invokes coder tools via CLI (works with Claude Code, Cursor CLI).
- **MCP integration**: for tools supporting Model Context Protocol, the app acts as MCP client.
- **Clipboard/paste bridge**: fallback — app compiles prompt to clipboard, user pastes into chat tool.

Phase 1-3: clipboard/paste bridge (manual). Phase 4: file-based and CLI bridges. Phase 5: MCP.

## 7. Anti-drift architecture

Seven mechanisms:
1. Watch-file declarations in doc frontmatter (manual declaration, auto-checked)
2. Run artifact import with automatic stale-flag comparison
3. Automatic conflict detection between docs
4. Forced review/closure workflow (size-gated)
5. Truth-doc update enforcement
6. Cheat-sheet invalidation and refresh
7. Solved issue reuse across projects

## 8. Storage architecture

Dual storage with app bridging:
- **Obsidian vault**: knowledge/ folder contents. Markdown indexed by Obsidian for search, backlinks, graph.
- **Local operational folders**: tasks/, runs/, agents/, conversations/. Structured JSON + markdown.
- **Bridge**: on run close, records written to both: JSON for querying, markdown for Obsidian.

## 9. Tech stack (TBD)

Candidates:
- Web app (React + Node/Express + local file system access)
- Desktop app (Electron or Tauri for native FS access)
- Hybrid (web UI with local file server)

Requirements: local file read/write, folder watching for artifact import, Obsidian vault path access.

## 10. Success criteria

Command and Conquer is successful if it:
- makes AI-assisted development repeatable
- preserves useful development memory via decision anchors
- prevents stale context via watch-file staleness
- supports many projects with one-active-repo discipline
- reduces token spend through structured context and mode selection
- provides obvious review and closure discipline (size-gated, not overhead)
- makes the decision record a 5-second action, not a chore
