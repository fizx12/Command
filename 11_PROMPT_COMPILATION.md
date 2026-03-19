# Prompt Compilation

## 1. Principle
Prompts are assembled from stable blocks, not rewritten from scratch. Every implementer prompt includes a mandatory artifact tail that tells the coder exactly what files to produce.

## 2. Standard MAX stack (positions 1-11)

1. Global rules
2. Master prompt shell
3. Project primer
4. Source-of-truth index
5. Selected cheat sheets
6. Task spec (includes size, active repo, scope, must-not-break)
7. Planner output
8. Carry-forward notes
9. Relevant decision anchors (AI-selected from previous tasks on same files/area)
10. Role instructions
11. Output format
12. **Artifact tail block** (mandatory — see section 4)

## 3. WeakSAUCE stack (minimal)

1. Task spec
2. Invariants / must-not-break rules
3. One relevant cheat sheet
4. Named files only
5. Relevant decision anchors (if any — kept brief)
6. Output format
7. **Artifact tail block** (mandatory — same as MAX)

No broad context. No primer. No architecture docs.

## 4. Artifact tail block

This block is appended to EVERY implementer prompt regardless of mode or task size. It is position 12 in MAX, position 7 in WeakSAUCE. It is never omitted.

```markdown
---

## ARTIFACT WRITE INSTRUCTIONS — REQUIRED

When your work is complete, write the following files to `{artifact_output_path}/RUN-{id}/`:

1. `job_result.json` — follow the schema exactly (schema attached below)
2. `job_summary.md` — plain English summary of what you did, what you didn't, and what's uncertain
3. `changed_files.json` — every file you touched, with change_type (added/modified/deleted/renamed) and risk_level (low/medium/high)
4. `review_checklist.json` — what you checked, what you skipped, what's unresolved
5. `code_snippets.md` — key new functions, changed signatures, before/after for risky edits

Do not summarize in chat. Do not skip artifacts because the task was small.
If you changed one file, the artifacts are still required — they will be shorter, not absent.

### job_result.json schema:
{schema_inline}
```

The `{artifact_output_path}` is resolved from the project's operational folder path + runs/. The `{id}` is the next sequential run ID. The `{schema_inline}` is the contents of `schemas/job_result.schema.json` inserted inline so the coder has it in context.

## 5. Output
- `compiled_prompt.md` — the fully assembled prompt ready to paste or export

## 6. Review before dispatch
If model/API cost matters, prompt generation can be previewed and approved before sending to an external tool.

## 7. Decision anchor context injection
When compiling a prompt, the system checks for DecisionAnchors from previous tasks that touched the same files (using the filesInPlay field). If found, a brief summary is injected at position 9:

```markdown
## Previous work context
- TASK-042 (Solved): Fixed auth token refresh race condition [src/auth/refresh.ts, src/middleware/auth.ts]
- TASK-038 (Bug patch): Patched null check in session validator [src/auth/session.ts]
```

This gives the coder awareness of recent decisions without requiring them to read full task histories.
