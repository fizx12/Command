# Knowledge System and Anti-Drift Architecture

## 1. Why drift happens
- chat memory is unreliable
- docs go stale without anyone noticing
- work finishes without closure
- solved issues are forgotten
- cheat sheets stop matching code

## 2. Anti-drift mechanisms

### 2.1 Watch-file declarations
Every important source document declares in its frontmatter which code files it covers:

```yaml
---
title: Authentication Architecture
watchFiles:
  - src/auth/**
  - src/middleware/auth.ts
  - src/types/auth.ts
trustLevel: authoritative
lastReviewedAt: 2026-03-15
---
```

When a run imports changed_files.json, the importer compares every changed file path against every doc's watchFiles globs. Any overlap automatically sets the doc's staleFlag to true.

This is the primary staleness trigger. It is automatic, file-overlap based, and runs on every import.

### 2.2 Automatic conflict detection
The Truth Maintainer agent and the Run Importer both check for conflicting information between docs. When detected:
- A ConflictRecord is auto-created with AI-generated summary and recommendation
- Both docs get conflictFlag set to true
- The Conflict Resolution Panel surfaces it to the user
- User picks resolution: accept A, accept B, or manual merge
- Detection is automatic. Resolution is manual.

### 2.3 Truth maintenance
Every approved task must:
- update relevant truth docs (those with staleFlag from this run)
- or explicitly mark "no update needed" with reason

### 2.4 Cheat sheet invalidation
Each cheat sheet links to source areas via watchFiles (inherited from source docs or declared directly). If related files changed, mark it stale.

### 2.5 Closure gating (size-gated)
A task is not truly done until:
- review passed
- closure written (depth varies by task size)
- docs updated or waived
- follow-up decided
- decision anchor completed

### 2.6 Solved issue reuse
Every meaningful solution is stored as a SolvedIssue with structured fields. Searchable by symptom, tag, project, and global key. Stored in both operational JSON and Obsidian vault markdown.

### 2.7 Periodic re-audit
Support three levels:
- light refresh: check freshness metadata only
- deep refresh: Truth Maintainer reads docs against current code
- changed-files-only refresh: only check docs whose watchFiles match recent changes

## 3. Truth labels
- authoritative (the definitive source)
- derived (generated from authoritative sources)
- stale (watchFiles triggered, needs review)
- conflicting (contradicts another doc)
- legacy but still live (old but still in use)
- unclear (needs investigation)

## 4. Required knowledge artifacts
- project primer
- source-of-truth index
- repo map
- architecture/data flow
- store/service contracts
- mechanics/system rules
- risk map
- tech debt/friction
- stronger-AI primer
- cheat sheets
- solved issues
- decision log (includes decision anchors)

## 5. Storage split

Knowledge artifacts live in the **Obsidian vault** for search, backlinks, and graph:
- all items in section 4 above
- solved issues (markdown copy)
- decision records and anchors (markdown copy)

Operational artifacts live in **local folders**:
- tasks, runs, conversations
- JSON versions of solved issues, decisions, anchors (for app queries)

The app bridges them: writes to both on closure events.
