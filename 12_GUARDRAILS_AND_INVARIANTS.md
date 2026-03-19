# Guardrails and Invariants

## 1. Global guardrails
- no unrelated cleanup
- inspect before editing
- keep diffs narrow
- state risks honestly
- preserve invariants unless task explicitly changes them
- use file-based artifacts, not transcript summaries
- one active repo per task — do not touch files in other repos

## 2. Project invariants
Each project defines its own must-not-break set.

Example categories:
- runtime semantics
- routing identity
- persistence contracts
- apply boundary
- canonical editing surface
- visualization semantics

These are loaded into every prompt via the task spec's mustPreserve[] field.

## 3. Review guardrails
A reviewer must check:
- in scope?
- invariants preserved?
- all required artifacts present and valid against schema?
- validation concrete (not vague "looks good")?
- docs refreshed or waived with reason?
- follow-up needed?

## 4. Size-gated closure guardrails

### All sizes
- decision anchor completed (hard block — no exceptions)

### Micro
- status picker completed
- auto-generated summary confirmed
- no further checks required

### Standard
- AI-drafted closure reviewed and confirmed by user
- remaining gaps listed (can be empty)
- follow-up decision made (create task or explicitly "none needed")
- stale docs acknowledged (update or waive with reason)

### Major
- AI-drafted full closure reviewed and confirmed
- remaining gaps listed and addressed
- follow-up tasks created for any open gaps
- doc update check: mandatory, cannot waive without written reason
- solved issue creation: prompted if reusable pattern detected
- risk assessment reviewed

## 5. Decision anchor guardrails
- triggered at every session/task boundary — not size-gated
- hard block: cannot proceed without completing
- AI drafts summary from run artifacts, user confirms or edits
- status must be selected from: Solved / Broken / Unsolved / Bug patch / Update / Difficult problem with solution
- filesInPlay auto-populated — user should not need to manually list files
- total interaction time target: ~5 seconds

## 6. Staleness guardrails
- watch-file declarations are manual (declared in doc frontmatter)
- stale flagging is automatic (triggered by run import file-overlap comparison)
- stale status is "unresolved" — there is no separate stale resolution workflow, just update the doc or acknowledge
- a doc with staleFlag = true contributes to yellow health badge

## 7. Conflict guardrails
- conflict detection is automatic (Run Importer + Truth Maintainer)
- conflict resolution is manual (user picks in Conflict Resolution Panel)
- AI generates conflict summary and recommendation, but user decides
- unresolved conflicts contribute to red health badge
- conflicts are tracked as ConflictRecords with full audit trail

## 8. Artifact guardrails
- every implementer prompt includes artifact tail block — no exceptions
- artifact tail is auto-appended by the prompt builder, not manually added
- run importer validates against JSON schemas before accepting
- a run without valid artifacts is rejected (not imported)
- small tasks produce small artifacts, not no artifacts
