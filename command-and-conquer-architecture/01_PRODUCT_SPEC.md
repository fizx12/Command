# Product Spec

## 1. Users
Primary user:
- a solo builder managing many apps and repos with AI coding tools

Secondary user:
- future collaborators who need to understand project context quickly

## 2. Primary jobs-to-be-done
- define and scope work clearly (with task size classification)
- choose the right agent/mode
- generate the right prompt (with artifact tail auto-appended)
- send work to an external coding tool
- ingest results automatically (schema-validated)
- review and close work cleanly (size-gated, AI-drafted)
- keep project docs and cheat sheets fresh (watch-file staleness)
- avoid re-solving known problems (solved issue library)
- record decisions at every transition (decision anchor gates)

## 3. Key product features

### 3.1 Multi-project management
- project list with health badges (green / yellow / red)
- repo links (multiple per project, one active at a time)
- tool config per project
- recent runs
- project health summary

### 3.2 Agent-driven workflow
- choose role and mode
- compile prompt (artifact tail auto-appended)
- export prompt file
- ingest coder result (schema-validated)
- review and continue

### 3.3 Task lifecycle
Statuses: backlog, active, blocked, review, approved, done, archived

Task sizes: Micro / Standard / Major (determines closure requirements)

### 3.4 Knowledge memory
- source docs (with watch-file frontmatter)
- cheat sheets
- solved issues
- decision records (including anchors)

Dual storage: Obsidian vault for knowledge, local folders for operations.

### 3.5 Freshness and anti-drift
- watch-file staleness detection (automatic on run import)
- automatic conflict detection
- cheat sheet invalidation
- unresolved task reminders
- health badge per project

### 3.6 Decision anchor gates
Hard block at session/task boundaries:
- status picker: Solved / Broken / Unsolved / Bug patch / Update / Difficult problem with solution
- AI-drafted one-line summary from run artifacts
- user confirms or edits
- ~5 seconds to complete
- produces structured JSON + markdown for Obsidian

### 3.7 Size-gated closure
- **Micro**: near-zero friction — status picker + auto-generated summary
- **Standard/Major**: AI drafts full closure from artifacts, user reviews

## 4. Non-goals
- not a replacement for your repos
- not a code editor
- not a chat transcript archive
- not a one-shot autonomous coder
