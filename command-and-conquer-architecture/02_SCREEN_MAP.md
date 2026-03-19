# Screen Map

## 1. Workspace Dashboard

Shows:
- all projects with health badges (green / yellow / red)
- recent tasks and recent runs
- stale knowledge alerts
- unresolved reviews
- follow-up reminders

Health badge logic:
- **Green**: no stale docs, no stuck reviews, no conflicts
- **Yellow**: any stale knowledge doc OR any task in Review state older than 48hrs
- **Red**: any of the above PLUS an unresolved conflict

## 2. Projects Screen

Shows:
- project cards with health badge
- repo paths (multiple per project)
- preferred tools
- recent activity

## 3. Project Detail

Tabs: Overview, Repositories, Tasks, Runs, Agents, Knowledge, Decisions, Settings

Overview shows health badge, active repo selector, quick stats.

## 4. Task Board

Views: Kanban by status, list by priority, filters by project/agent/mode/size

Task detail includes: task spec, task size (Micro / Standard / Major), active repo, scope, must-not-break rules, linked runs, review state, closure state, follow-ups, decision anchor (if closed).

## 5. Decision Anchor Gate (modal / interstitial)

Triggered when user attempts to: start a new task, open a new conversation/prompt, or switch projects.

Shows:
- current task/session summary (AI-drafted from run artifacts)
- status picker: Solved / Broken / Unsolved / Bug patch / Update / Difficult problem with solution
- one-line notes field (AI-drafted, user confirms or edits)
- confirm button

**Hard block** — cannot proceed without completing. Takes ~5 seconds.

## 6. Prompt Builder

Controls: select project, select agent, select mode, select active repo, select context docs, compile prompt (artifact tail auto-appended), preview prompt, export prompt file.

## 7. Run Importer

Features:
- watch configured folders for new artifacts
- import and validate against JSON schemas
- attach to task
- show diff summary
- auto-flag stale docs (compare changed_files against watch-file declarations)
- auto-detect conflicts between docs

## 8. Review Panel

Shows: task spec, planner output, implementer output, changed files, code snippets, validation checklist.

Actions: approve, revise, reject, create next prompt, create follow-up task.

## 9. Conflict Resolution Panel

Shows:
- two conflicting docs side by side
- AI-generated summary of the conflict with recommendation
- user picks: accept left / accept right / manual merge
- resolution recorded

Triggered automatically when conflict detected by importer or Truth Maintainer.

## 10. Knowledge Center

Sections: Source Documents (with watch-file status indicators), Cheat Sheets, Solved Issues, Decision Records (including anchors), Freshness Queue.

Dual view: Obsidian vault status and local folder status.

## 11. Agent Library

Shows: agent definitions, mode presets, system prompts, output formats, review checklists.

## 12. Settings

Workspace settings, storage locations (Obsidian vault path, operational folder path), artifact folder rules, default models, connector settings, watch folder paths for run import.
