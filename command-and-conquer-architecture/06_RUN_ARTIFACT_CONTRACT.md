# Run Artifact Contract

Every coder run must produce these files in `{artifact_output_path}/RUN-{id}/`:

- `job_result.json` (required)
- `job_summary.md` (required)
- `changed_files.json` (required)
- `review_checklist.json` (required)
- `code_snippets.md` (required)
- `git_diff.patch` (optional)

## job_result.json

Required fields:
- job_id (string)
- tool (string — which coder tool was used)
- model (string — which model was used)
- status (string — success / partial / failed)
- task_title (string)
- scope (string)
- files_inspected[] (string[])
- files_changed[] (string[])
- summary (string)
- risks[] (object[] — { description, severity, mitigation })
- manual_validation[] (object[] — { check, result, notes })
- remaining_gaps[] (string[])
- commit_hash (string, nullable)

See schemas/job_result.schema.json for full JSON Schema.

## changed_files.json

Required fields per entry:
- path (string)
- change_type (string — added / modified / deleted / renamed)
- purpose (string)
- risk_level (string — low / medium / high)

See schemas/changed_files.schema.json for full JSON Schema.

## review_checklist.json

Required fields:
- checks_run[] (object[] — { check, passed, notes })
- checks_skipped[] (object[] — { check, reason })
- unresolved_items[] (object[] — { item, severity, notes })

See schemas/review_checklist.schema.json for full JSON Schema.

## job_summary.md

Plain English summary covering:
- what was done
- what was not done
- what is uncertain
- key decisions made during implementation

## code_snippets.md

Include:
- key new files created
- new/changed function signatures
- contract changes (types, interfaces, APIs)
- important before/after snippets for risky edits
- schema/type changes

## Import rules

1. A run is not considered complete until all required artifacts are written.
2. The Run Importer validates artifacts against JSON schemas on import.
3. On import, the importer compares changed_files entries against all SourceDocument watch-file declarations. Any overlap sets the staleFlag on the affected docs.
4. On import, the importer checks for content conflicts between docs and auto-creates ConflictRecords.
5. Artifacts are stored in the operational folder (local), not the Obsidian vault.
