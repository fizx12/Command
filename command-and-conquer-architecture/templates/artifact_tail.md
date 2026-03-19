## ARTIFACT WRITE INSTRUCTIONS — REQUIRED

When your work is complete, write the following files to `{artifact_output_path}/RUN-{id}/`:

1. `job_result.json` — follow the schema exactly (schema attached below)
2. `job_summary.md` — plain English summary of what you did, what you didn't, and what's uncertain
3. `changed_files.json` — every file you touched, with change_type (added/modified/deleted/renamed) and risk_level (low/medium/high)
4. `review_checklist.json` — what you checked, what you skipped, what's unresolved
5. `code_snippets.md` — key new functions, changed signatures, before/after for risky edits

Do not summarize in chat. Do not skip artifacts because the task was small.
If you changed one file, the artifacts are still required — they will be shorter, not absent.
