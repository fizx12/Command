# Folder Schema

Two storage layers with an app bridge between them.

## Operational layer (local folders — app reads/writes directly)

```txt
CommandAndConquer/
  system/
    GLOBAL_RULES.md
    MASTER_PROMPT.md
    OUTPUT_FORMAT.md
    REVIEW_CHECKLIST.md
    AGENT_LIBRARY.md
  workspace/
    projects/
      <project-id>/
        overview/
          project.config.json
          project-summary.md
        agents/
          auditor_max.md
          planner_max.md
          implementer_max.md
          reviewer_max.md
          compressor_max.md
          truth_maintainer_max.md
          ux_critic_max.md
          task_closer_max.md
          planner_weaksauce.md
          implementer_weaksauce.md
          reviewer_weaksauce.md
        tasks/
          TASK-001/
            task_spec.md
            planner_output.md
            implementer_prompt.md        (includes artifact tail)
            reviewer_prompt.md
            review_result.md
            next_prompt.md
            closure.json                 (structured closure record)
            closure.md                   (human-readable closure)
            decision_anchor.json         (structured anchor)
            followups.md
            carry_forward.md
        runs/
          RUN-001/
            job_result.json
            job_summary.md
            changed_files.json
            review_checklist.json
            code_snippets.md
            git_diff.patch
        conversations/
          CONVO-001/
            context_bundle.md
            active_prompt.md
            completion_summary.md
        conflicts/
          CONFLICT-001.json              (ConflictRecord)
    global/
      GLOBAL_SOLVED_ISSUES.json
      GLOBAL_AGENT_NOTES.md
  schemas/
    job_result.schema.json
    changed_files.schema.json
    review_checklist.schema.json
    decision_anchor.schema.json
    closure.schema.json
    conflict.schema.json
```

## Knowledge layer (Obsidian vault — indexed for search/backlinks)

```txt
ObsidianVault/
  CommandAndConquer/
    <project-id>/
      APP_PRIMER.md
      SOURCE_OF_TRUTH_INDEX.md
      REPO_MAP.md
      ARCHITECTURE_AND_DATAFLOW.md
      STORE_SERVICE_CONTRACTS.md
      MECHANICS_AND_SYSTEM_RULES.md
      CHANGE_RISK_MAP.md
      TECH_DEBT_AND_FRICTION.md
      PROMPT_PRIMER_FOR_STRONGER_AI.md
      DECISION_LOG.md
      cheat-sheets/
        CHEAT_TASK_RUNTIME.md
        CHEAT_FOCUS_TIMER.md
        CHEAT_PROTOCOL.md
        (etc — project-specific)
      solved/
        SOLVED-001.md
        SOLVED-002.md
        (etc — one file per solved issue)
      decisions/
        ANCHOR-001.md
        ANCHOR-002.md
        DECISION-001.md
        (etc — anchors and full decision records)
```

## Watch-file frontmatter format

Every source doc and cheat sheet in the Obsidian vault uses this frontmatter:

```yaml
---
title: Authentication Architecture
category: architecture
trustLevel: authoritative
watchFiles:
  - src/auth/**
  - src/middleware/auth.ts
  - src/types/auth.ts
lastReviewedAt: 2026-03-15
lastUpdatedAt: 2026-03-15
staleFlag: false
---
```

The app reads this frontmatter to know which docs to flag when a run changes matching files.

## Bridge behavior

On task closure:
1. ClosureRecord written to `tasks/TASK-xxx/closure.json`
2. DecisionAnchor written to `tasks/TASK-xxx/decision_anchor.json`
3. If solved issue created: JSON to `global/GLOBAL_SOLVED_ISSUES.json`, markdown to Obsidian `solved/SOLVED-xxx.md`
4. If decision record created: markdown to Obsidian `decisions/DECISION-xxx.md`
5. Anchor markdown always pushed to Obsidian `decisions/ANCHOR-xxx.md`
