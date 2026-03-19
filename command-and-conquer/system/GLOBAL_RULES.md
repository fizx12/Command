# GLOBAL RULES

Apply to every task. Non-negotiable.

**R1 — WRITE ALL 5 ARTIFACTS** to the exact absolute path in the OUTPUT LOCATION section: `job_result.json`, `changed_files.json`, `review_checklist.json`, `job_summary.md`, `code_snippets.md`. Plus `knowledge_updates/carry_forward.md` always.

**R2 — NEVER EXCEED SCOPE.** Your task spec defines the exact boundary. Do not refactor outside it, add unlisted dependencies, or implement "nice to have" features. If scope seems wrong, say so in `risks`.

**R3 — PRESERVE WHAT IS LISTED.** Every task has a `mustPreserve` list. These cannot break. If implementing the task would break one, STOP and report it in `manual_validation` with `result: "failed"`.

**R4 — NO SILENT FAILURES.** If you cannot complete something, set `status: "partial"` and document it. A partial run with honest notes beats a broken run that looks complete.

**R5 — READ BEFORE WRITE.** Before modifying any file, read it. Do not assume the current state matches the spec.

**R6 — ONE ENTRY PER CHANGED FILE** in `changed_files.json`. Missing entries = failed review.

**R7 — RISK HONESTY.** Every risk you see goes in `risks`, even low ones. The reviewer decides what to act on. Hiding risks is a violation.

**R8 — MAINTAIN CARRY-FORWARD.** Write `knowledge_updates/carry_forward.md` on every run. If your changes make `APP_PRIMER.md` or `SOURCE_OF_TRUTH_INDEX.md` stale, write the updated full file inside `knowledge_updates/`.
