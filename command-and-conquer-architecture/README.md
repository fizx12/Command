# Command and Conquer — Architecture Pack v2

Complete architecture and specification for the Command and Conquer AI development control plane.

All decisions from the design audit have been incorporated.

## Contents

### Specs (read in order)
- `00_MASTER_ARCHITECTURE.md` — start here
- `01_PRODUCT_SPEC.md` — features and jobs-to-be-done
- `02_SCREEN_MAP.md` — every screen with health badges, decision anchor gate, conflict panel
- `03_DATA_MODEL.md` — all entities including DecisionAnchor, ConflictRecord, task sizing
- `04_AGENT_SYSTEM.md` — agent roster with artifact tail responsibility
- `05_MAX_AND_WEAKSAUCE_MODES.md` — mode definitions and selection rules
- `06_RUN_ARTIFACT_CONTRACT.md` — what every coder run must produce
- `07_KNOWLEDGE_AND_ANTI_DRIFT.md` — watch-files, conflict detection, staleness
- `08_WORKFLOWS.md` — all workflows including size-gated closure and decision anchors
- `09_MVP_BUILD_ORDER.md` — phased build plan (5 phases)
- `10_FOLDER_SCHEMA.md` — dual storage: Obsidian vault + local operational folders
- `11_PROMPT_COMPILATION.md` — prompt stack with artifact tail block template
- `12_GUARDRAILS_AND_INVARIANTS.md` — all guardrails including size-gated closure rules
- `13_CODING_STRATEGY.md` — smart guardrails + cheap coders split, model routing, prompt templates
- `14_PHASE1_CHUNK_MANIFEST.md` — exact 71-file build order with model assignments per chunk

### Schemas
- `schemas/job_result.schema.json`
- `schemas/changed_files.schema.json`
- `schemas/review_checklist.schema.json`
- `schemas/decision_anchor.schema.json`
- `schemas/closure.schema.json`
- `schemas/conflict.schema.json`

### Templates
- `templates/artifact_tail.md` — copy-pasteable artifact tail block for prompts
- `templates/decision_anchor_prompt.md` — the modal text for decision anchor gates
- `templates/watchfile_frontmatter.md` — frontmatter template for knowledge docs

## Key decisions baked in
- Artifact writing is the coder agent's job (artifact tail in every prompt)
- Staleness uses watch-file declarations in doc frontmatter, auto-checked on import
- Conflict detection is automatic, resolution is manual with AI summary
- Health badges: green / yellow / red based on stale docs, stuck reviews, conflicts
- Multiple repos per project, one active at a time per task
- Decision anchors are hard blocks at every session/task boundary (~5 seconds)
- Closure is size-gated: Micro (near-zero friction), Standard/Major (AI-drafted)
- Storage is dual: Obsidian vault for knowledge, local folders for operations
- Bilateral coder communication planned for Phase 4+ (file bridge, CLI, MCP)
- Tech stack: Electron + React + TypeScript + Tailwind
- Coding strategy: Smart brain (Opus/Sonnet/Gemini Pro) plans and reviews, cheap coders (Flash/Haiku/Codestral) write code
- Phase 1: 21 smart-brain files + 50 cheap-coder files = 71 total, estimated cost $2-4
