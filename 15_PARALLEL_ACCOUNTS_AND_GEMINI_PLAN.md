# Parallel Execution Plan — Two Claude Slots + Gemini Flash Lanes

Goal: stop running the Phase 1 build one job at a time. Run work in parallel
across **Claude Slot 1**, **Claude Slot 2**, and cheap **Gemini Flash / Flash-Lite**
lanes, with automatic failover between the two Claude slots when one hits
its usage limit. Claude stays the driver (planner + reviewer); Gemini does typing.

This extends `13_CODING_STRATEGY.md` (smart brain / cheap hands) and feeds off
`14_PHASE1_CHUNK_MANIFEST.md` (one file per chunk = safe to parallelise).

---

## 1. Roles

| Lane | Engine | Job | Max concurrent |
|------|--------|-----|----------------|
| **Driver** | Claude (whichever slot is active) | Decompose, write chunk prompts, review, merge, closure | 1 |
| **Slot 1** | Claude Code, account 1 | Smart-brain chunks, hard fixes, reviews | 2–3 sessions |
| **Slot 2** | Claude Code, account 2 | Same as Slot 1; takes over when Slot 1 is limited | 2–3 sessions |
| **Flash-Lite** | Gemini Flash-Lite (API) | Types/interfaces, schema validators, boilerplate, tests | 4–6 calls |
| **Flash** | Gemini Flash (API) | React components, Tailwind, IPC handlers from spec | 3–4 calls |

Rule: Gemini output never merges without a Claude review pass
(`review_checklist.json`, section 7 of `13_CODING_STRATEGY.md`).
Max 2 Gemini retries per chunk, then the chunk escalates to a Claude slot.

---

## 2. Two Claude accounts side by side (local machine)

Each Claude Code login lives in its own config directory, so the two accounts
never overwrite each other's session.

```bash
# one-time, on your machine
CLAUDE_CONFIG_DIR=~/.claude-slot1 claude   # /login with account 1, then exit
CLAUDE_CONFIG_DIR=~/.claude-slot2 claude   # /login with account 2, then exit
```

Shell aliases (PowerShell equivalents: `$env:CLAUDE_CONFIG_DIR=...`):

```bash
alias c1='CLAUDE_CONFIG_DIR=~/.claude-slot1 claude'
alias c2='CLAUDE_CONFIG_DIR=~/.claude-slot2 claude'
```

Headless worker call (what the dispatcher runs):

```bash
CLAUDE_CONFIG_DIR=~/.claude-slot1 claude -p "<chunk prompt>" \
  --output-format json --permission-mode acceptEdits
```

Check that running two subscriptions this way fits your plans' terms.

---

## 3. Usage failover (Slot 1 ⇄ Slot 2)

Slot state lives in `system/slots.json` (operational folder, not the vault):

```json
{
  "active": "slot1",
  "slots": {
    "slot1": { "configDir": "~/.claude-slot1", "status": "ok",      "limitedUntil": null, "running": 2 },
    "slot2": { "configDir": "~/.claude-slot2", "status": "ok",      "limitedUntil": null, "running": 1 }
  },
  "softCapPerSlot": 3
}
```

Routing logic (`slot-router.service.ts`):

1. Pick the slot with `status: ok` and the fewest `running` jobs (spreads load
   across both accounts all the time, not only after one runs dry).
2. On worker exit, parse the JSON result. If it is an error mentioning a usage /
   rate limit (match on "usage limit", "rate limit", HTTP 429, or
   `is_error: true` with a reset time), mark that slot `limited`, store
   `limitedUntil` (parsed reset time, else now + 60 min), and **requeue the same
   chunk on the other slot** with no retry penalty.
3. Both slots limited → Claude-tier chunks wait; Gemini lanes keep running;
   the driver's review queue pauses until the earliest `limitedUntil`.
4. A timer flips `limited → ok` when `limitedUntil` passes.
5. The driver itself follows the same rule: if the session you're driving from
   is limited, open the other slot (`c1` / `c2`) and continue from
   `system/slots.json` + the run artifacts — every run writes its artifact tail,
   so no state lives only in a chat.

---

## 4. Gemini lanes

The app already has Gemini settings (`geminiEnabled`, `geminiApiKey`,
`geminiFlashModel`, `geminiProModel` in `Settings.tsx`) but
`gemini.service.ts` only calls OpenAI. Work needed:

- Add `_callGemini(key, model, prompt, maxTokens)` to `gemini.service.ts`
  (REST `generateContent`, same `https` style and the same
  `logCallStart` / `logCallEnd` tracing as `_callOpenAI`).
- Route by provider: `geminiEnabled` + tier → Gemini, else OpenAI (unchanged default).
- Add a `geminiFlashLiteModel` setting next to `geminiFlashModel`; update the
  stale defaults (`gemini-2.0-flash`, `gemini-1.5-pro`) to the current model IDs
  — confirm the exact IDs against Google's model list when implementing.
- Gemini lanes **return file contents**, they don't edit the repo. The dispatcher
  writes the file into the chunk's worktree, so Gemini needs no tool access.

Chunk → lane routing (extends section 3 of `13_CODING_STRATEGY.md`):

| Chunk type (from manifest) | Lane |
|---|---|
| `*.types.ts`, schema JSON, validators, constants | Flash-Lite |
| Test files, simple utils | Flash-Lite |
| React components, Tailwind, hooks | Flash |
| IPC handlers, file-store functions | Flash (escalate to Claude after 2 fails) |
| Services touching >1 domain, prompt compiler, router, anything "smart brain" in the manifest | Claude slot |
| Review of every Gemini chunk | Claude slot |

---

## 5. Parallel dispatcher

New main-process service `dispatcher.service.ts`:

- **Queue** = chunks from `14_PHASE1_CHUNK_MANIFEST.md` (and later, tasks from
  the task board), each with `dependsOn`, `lane`, `targetFile`.
- **Ready** = all `dependsOn` chunks approved. Types/interfaces go first so the
  wide layer (components, IPC) can fan out.
- **Isolation**: each running chunk gets its own git worktree
  (`git worktree add ../cc-wt/<chunkId> -b chunk/<chunkId>`). One file per chunk
  means merges back are near-conflict-free.
- **File lock**: a chunk can't start if another running chunk owns the same
  `targetFile`.
- **Concurrency**: per-lane caps from the table in section 1; Claude caps are
  per slot.
- **Pipeline per chunk**: generate (lane) → artifacts written →
  Claude review → approve = merge worktree branch into the build branch /
  revise = requeue with correction prompt / reject = escalate lane.
- **Logging**: every job appends to the run timeline with lane, slot, model,
  tokens, duration, outcome — this also feeds the "which model fails which task
  type" tracking already called for in `13_CODING_STRATEGY.md`.

---

## 6. Build order

| Step | What | Who | Parallel? |
|---|---|---|---|
| 0 | Set up `~/.claude-slot1`, `~/.claude-slot2`, Gemini API key; start Remote Control in the repo folder so the driver can reach your machine | You (10 min) | — |
| 1 | Gemini provider in `gemini.service.ts` + Flash-Lite setting | Slot 1 | with 2 |
| 2 | `slots.json` + `slot-router.service.ts` + limit detection | Slot 2 | with 1 |
| 3 | `dispatcher.service.ts` (queue, worktrees, locks, caps) | Slot 1 after 1 | — |
| 4 | Manifest parser → chunk queue with `lane` + `dependsOn` | Flash-Lite, reviewed | with 3 |
| 5 | Slots panel: per-slot status, running count, `limitedUntil`, lane queue depth | Flash, reviewed | with 3 |
| 6 | Dry run: 5 types chunks on Flash-Lite + 2 components on Flash + 1 service on each Claude slot | Driver | yes |
| 7 | Run the rest of Phase 1 through the dispatcher | Driver | yes |

---

## 7. Done when

- Two Claude slots run jobs at the same time, and a usage-limit error on one
  requeues the job on the other with no manual step.
- Gemini Flash / Flash-Lite chunks run in parallel and are reviewed by Claude
  before merge.
- Every job leaves artifacts + a timeline entry naming lane, slot and model.
- Phase 1 remaining chunks complete through the dispatcher.

## 8. Open decisions

- Concurrency caps per slot (start at 3, tune after the step 6 dry run).
- Whether OpenAI stays as a third lane or Gemini replaces it for cheap work.
- Auto-merge after Claude approve, or keep a human click per merge.
