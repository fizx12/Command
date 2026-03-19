# OUTPUT FORMAT

Write all files to the **exact absolute path in the OUTPUT LOCATION section**. Not a relative path. Not a guessed path.

---

### `job_result.json`
```json
{
  "task_id": "TASK-XXXXXX",
  "run_id": "RUN-XXXXXX",
  "tool": "cursor|claude|gemini|windsurf",
  "model": "claude-3-5-sonnet|gemini-2.0-flash|...",
  "status": "success",
  "summary": "One paragraph describing what was accomplished.",
  "risks": [{"description": "...", "severity": "low|medium|high", "mitigation": "..."}],
  "manual_validation": [{"check": "Concrete testable thing", "result": "passed|failed|skipped", "notes": ""}],
  "commit_hash": "abc1234",
  "created_at": "2026-01-01T00:00:00Z"
}
```
`status` values: `"success"` `"partial"` `"failed"` — nothing else.

---

### `changed_files.json`
```json
[{"path": "<FILE_PATH_HERE>", "change_type": "modified|created|deleted", "purpose": "...", "risk_level": "low|medium|high"}]
```
Every file you touched. No exceptions.

---

### `review_checklist.json`
```json
{
  "checks_run": [{"category": "functionality|security|performance|types|tests", "check": "Specific testable thing", "priority": "must|should|nice", "result": "passed|failed|skipped"}],
  "checks_skipped": [],
  "unresolved_items": []
}
```
Keys are `checks_run`, `checks_skipped`, `unresolved_items` — not `items`.

---

### `job_summary.md`
```markdown
# Job Summary: [Task Title]
## What Was Done
## Key Decisions
## What Was NOT Done (and why)
## Carry-Forward Notes
```

---

### `code_snippets.md`
The most important new or changed code with context. Focus on non-obvious logic a reviewer should study.

---

### `knowledge_updates/` *(always write `carry_forward.md`; others only if architecture changed)*
```
knowledge_updates/
  carry_forward.md          ← always
  APP_PRIMER.md             ← only if architecture/patterns changed
  SOURCE_OF_TRUTH_INDEX.md  ← only if file roles or data flow changed
```
Write full updated files, not diffs.
