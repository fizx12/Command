# Workflows

## 1. Standard task workflow
1. Create task (assign size: Micro / Standard / Major)
2. Run Planner (recommends mode, confirms size, identifies active repo)
3. Review plan
4. Generate implementer prompt (artifact tail auto-appended)
5. Send to external coding tool (clipboard/paste in Phase 1-3)
6. Import run artifacts (schema-validated, stale/conflict auto-detected)
7. Run Reviewer
8. Approve / revise / reject
9. Run Task Closer (size-gated closure)
10. Decision anchor gate (hard block before next task)

## 2. Audit workflow
1. Run Auditor
2. Create/update audit pack
3. Refresh primer and source-of-truth index
4. Mark stale/conflicting docs
5. Generate ConflictRecords for any detected conflicts

## 3. WeakSAUCE patch workflow
1. Create targeted task (size: Micro)
2. Select WeakSAUCE Planner
3. Compile minimal prompt (artifact tail still included)
4. External coder executes
5. Import artifacts
6. WeakSAUCE Reviewer checks scope only
7. Close task (Micro closure — status picker + auto-summary)
8. Decision anchor gate

## 4. Solved issue workflow
1. Reviewer or Task Closer identifies reusable solution
2. Create SolvedIssue record
3. Link affected runs/tasks
4. Add reusable pattern notes
5. Write to both: JSON in operational folder + markdown in Obsidian vault
6. Make searchable across project and global library

## 5. Decision anchor workflow
Triggered at every session/task boundary (hard block).

1. App detects transition: new task, new conversation, project switch
2. App pulls run artifacts from current session/task
3. AI drafts one-line summary and suggests status
4. User sees modal with:
   - status picker: Solved / Broken / Unsolved / Bug patch / Update / Difficult problem with solution
   - AI-drafted summary (editable)
   - files in play (auto-populated)
5. User confirms or edits (~5 seconds)
6. DecisionAnchor record created (JSON in task folder + markdown in Obsidian)
7. User proceeds to next task/conversation

Cannot be skipped. Not size-gated — applies equally to all tasks.

## 6. Compressor workflow (post-approval doc refresh)
1. Task approved by Reviewer
2. Run Compressor agent against approved run artifacts
3. Compressor identifies which primers, cheat sheets, and handoff docs need updating based on changed files and watch-file declarations
4. Compressor drafts updated sections
5. User reviews and approves doc changes
6. Updated docs written to Obsidian vault
7. Freshness metadata updated (lastReviewedAt, staleFlag cleared)

Triggered after step 8 (approve) in Standard task workflow. Optional for Micro tasks.

## 7. UX Critic workflow
1. After implementation approved, run UX Critic agent
2. UX Critic reviews product flow changes (not just code correctness)
3. Produces UX feedback: flow issues, confusing states, missing edge cases in UI
4. Feedback attached to task as a review note
5. If issues found: creates follow-up tasks for UX fixes

Optional — invoked manually when the task involves user-facing changes.

## 8. Conflict resolution workflow
1. Conflict detected (by Run Importer or Truth Maintainer) — automatic
2. ConflictRecord created with AI-generated summary and recommendation
3. Both docs flagged (conflictFlag = true)
4. Project health badge goes yellow or red
5. User opens Conflict Resolution Panel
6. Sees both docs side by side with AI summary
7. Picks resolution: accept A / accept B / manual merge
8. Resolution recorded, flags cleared

## 9. Size-gated closure detail

### Micro closure
- auto-generated one-line summary from run artifacts
- status picker only
- no gap analysis required
- no doc update check required (but stale flags still show)
- total time: ~10 seconds

### Standard closure
- AI-drafted closure summary from run artifacts
- AI-drafted remaining gaps list
- user reviews and confirms or edits
- doc update check: prompted if any stale docs exist
- follow-up task creation: prompted if gaps exist
- total time: ~1-2 minutes

### Major closure
- AI-drafted full closure: summary, gaps, risk assessment
- doc update check: mandatory, cannot waive without reason
- follow-up task creation: mandatory if gaps exist
- solved issue creation: prompted if reusable pattern detected
- total time: ~3-5 minutes
