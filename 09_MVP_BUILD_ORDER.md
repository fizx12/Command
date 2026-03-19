# MVP Build Order

## Phase 1 — Core skeleton
- Project CRUD + repo linking (multi-repo, active repo selector)
- Task CRUD with size classification (Micro / Standard / Major)
- Agent definitions (store and display)
- Prompt builder with artifact tail auto-append
- Run importer with JSON schema validation
- Basic folder structure creation (operational folders)

## Phase 2 — Knowledge and review
- Source document management with watch-file frontmatter
- Cheat sheet management
- Auto-stale detection on run import (watchFiles vs changedFiles comparison)
- Review panel (approve / revise / reject)
- Size-gated closure workflow (Micro / Standard / Major paths)
- Decision anchor gate (hard block at task/session boundaries)

## Phase 3 — Memory and intelligence
- Solved issues library (create, search, cross-project reuse)
- Decision records (full records + anchor history)
- Automatic conflict detection + Conflict Resolution Panel
- Code snippet history viewer
- Health badge computation (green / yellow / red)
- Freshness dashboard
- Obsidian vault integration (write markdown copies of knowledge artifacts)

## Phase 4 — Connectivity
- File-based bilateral bridge (app writes instructions, watches for artifacts)
- CLI bridge for Claude Code / Cursor
- Git diff/status integration
- File search within repos
- Prompt versioning

## Phase 5 — Optimization
- MCP integration for supported tools
- Model routing and cost tracking
- Bulk operations (multi-task closure, batch stale-flag review)
- Analytics (closure velocity, drift frequency, reuse rate)

## Build priority notes

The **artifact tail in the prompt builder** is the Phase 1 piece that makes everything else work. Build and test it before the dashboard UI — if coders don't produce structured artifacts, nothing downstream functions.

The **decision anchor gate** is the Phase 2 piece that prevents context loss. It should be built early in Phase 2 because every task that closes without an anchor is lost memory.

The **Obsidian vault bridge** in Phase 3 is a write-only operation (app pushes markdown to vault folder). It does not need to read from Obsidian. This keeps it simple.
