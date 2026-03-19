# Agent System

## 1. Design
Agents are reusable role definitions with prescripted behavior. They are not free-form personas. They are controlled operators.

Every agent prompt compiled for an Implementer role includes a mandatory artifact tail section — the coder is told exactly what files to produce and where.

## 2. Agent roster

### MAX
- Auditor MAX
- Planner MAX
- Implementer MAX
- Reviewer MAX
- Compressor MAX
- Truth Maintainer MAX
- UX Critic MAX
- Task Closer MAX

### WeakSAUCE
- Planner WeakSAUCE
- Implementer WeakSAUCE
- Reviewer WeakSAUCE

## 3. Required fields for every agent
- name
- role
- mode (MAX or WeakSAUCE)
- purpose
- inputs
- outputs
- must-do checks
- failure conditions
- escalation rules
- preferred model

## 4. Auditor
Reads repo/docs and updates audit pack. Flags stale docs, detects conflicts, updates freshness metadata.

## 5. Planner
Builds the smallest safe patch plan from a request. Recommends task size (Micro / Standard / Major) and mode (MAX / WeakSAUCE). Identifies active repo for the task.

## 6. Implementer
Compiles the prompt and instructions for an external coding tool. The compiled prompt always includes the artifact tail block (see 11_PROMPT_COMPILATION.md) which instructs the coder to write:
- job_result.json
- job_summary.md
- changed_files.json
- review_checklist.json
- code_snippets.md

This is non-negotiable. The artifact tail is part of every implementer prompt regardless of task size.

## 7. Reviewer
Approves/revises/rejects based on scope and invariants. Checks that all required artifacts are present and complete.

## 8. Compressor
Updates primers, cheat sheets, and handoff docs after approved changes. Respects watch-file declarations to know what docs need updating.

## 9. Truth Maintainer
Keeps source docs fresh. Runs periodic checks:
- compares doc watch-files against recent run changedFiles
- flags stale docs
- detects conflicting docs (auto-creates ConflictRecord with AI summary)
- updates freshness metadata

## 10. UX Critic
Calls out when the product flow is still bad even if the code is technically correct.

## 11. Task Closer
Forces closure, follow-up creation, and completion discipline. Behavior varies by task size:
- **Micro**: auto-generates minimal closure, presents status picker
- **Standard**: AI-drafts closure summary and gap analysis, user confirms
- **Major**: AI-drafts full closure with gap analysis, doc update check, follow-up recommendations
