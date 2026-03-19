# BUILD PLAYBOOK — Command and Conquer Phase 1

## How to use this

Each step has a prompt file. Copy-paste the prompt into the specified AI. Wait for output. Paste output into the next step. Steps within a step can run in parallel across multiple AI sessions.

## ⚠️ CRITICAL: Context Bundle Rule

**Every prompt must be prefixed with `CONTEXT_BUNDLE.md`.**

The file `prompts/CONTEXT_BUNDLE.md` contains the full project description, file structure, data storage layout, IPC pattern, Tailwind theme, and key concepts. Every AI — smart or cheap — needs this context to produce code that fits the system.

**How to send a prompt:**
1. Copy the contents of `CONTEXT_BUNDLE.md`
2. Paste it at the top of your message
3. Then paste the step prompt below it
4. Send

**For Steps 2-6 (cheap coders): also paste the relevant type files.**
After Step 1B produces the type files, save them. When sending a service/IPC/hook/component/page prompt to a cheap coder, paste these files between the context bundle and the prompt:
- Services (Step 2): paste ALL type files (the service needs to know every interface it works with)
- IPC handlers (Step 3): paste the types + the service file it wraps (so it knows the method signatures)
- Hooks (Step 4): paste `preload/api.ts` (so it knows the window.api shape)
- Components (Step 5): paste just the types the component references in its props
- Pages (Step 6): paste the hook files the page imports (so it knows what data is available)

This adds ~2K tokens to each prompt but prevents hallucinated interfaces and wrong method names.

## The Pipeline

```
STEP 1A (Sonnet) ──────────┐
                            ├── STEP 1C (Smart AI review) ── STEP 2 ── STEP 2 REVIEW
STEP 1B (ChatGPT 5.4) ─────┘                                              │
                                                                    STEP 3 ── STEP 3 REVIEW
                                                                           │
                                                                    STEP 4 ── STEP 4 REVIEW
                                                                           │
                                                                    STEP 5 ── STEP 5 REVIEW
                                                                           │
                                                                    STEP 6 ── STEP 6 REVIEW
                                                                           │
                                                                    STEP 7 (integration test)
```

## Step-by-Step

### STEP 1A — Electron Scaffold (Sonnet)
- **File:** `prompts/STEP1A_SONNET_SCAFFOLD.md`
- **AI:** Claude Sonnet (via Cursor, Claude Code, or IDE)
- **Produces:** 12 files (package.json, configs, Electron entry, preload, React shell, file store, schema validator)
- **Time:** ~5 minutes
- **Can run in parallel with:** Step 1B

### STEP 1B — TypeScript Types (ChatGPT 5.4)
- **File:** `prompts/STEP1B_CHATGPT_TYPES.md`
- **AI:** ChatGPT 5.4
- **Produces:** 11 files (10 type files + barrel export)
- **Time:** ~3 minutes
- **Can run in parallel with:** Step 1A

### STEP 1C — Foundation Review
- **File:** `prompts/STEP1C_REVIEW.md`
- **AI:** Whichever smart AI is free (Sonnet, Gemini Pro, or ChatGPT 5.4)
- **Input:** Paste outputs from BOTH Step 1A and 1B
- **Produces:** List of issues or "APPROVED"
- **Action:** Fix any issues before proceeding. Have the original AI fix its own output.

### After Step 1C passes:
1. Create the project folder on your machine
2. Put all files in their specified paths
3. Run `npm install`
4. Run `npm run dev` — should compile with no errors
5. App should open an empty Electron window with sidebar and placeholder pages

If it doesn't compile: paste errors into smart AI to fix.

---

### STEP 2 — Services (Cheap Coders)
- **File:** `prompts/STEP2_SERVICES.md`
- **AI:** Codestral (S1-S4, S8, S9), Haiku (S5-S7)
- **Produces:** 9 service files
- **Parallel:** Sub-batch A (S1, S2, S3, S5) → Sub-batch B (S4, S6, S7) → Sub-batch C (S8, S9)
- **Review:** Paste all 9 into smart AI with the review prompt at bottom of file
- **Time:** ~10 minutes total

### STEP 3 — IPC Handlers (Cheap Coders)
- **File:** `prompts/STEP3_IPC_HANDLERS.md`
- **AI:** Gemini Flash (all 7 files)
- **Produces:** 7 IPC handler files
- **Parallel:** All 7 at once
- **Review:** Review prompt at bottom of file
- **Time:** ~5 minutes

### After Step 3:
- Wire up IPC handlers in `src/main/index.ts`:
  - Import `registerAllHandlers` from './ipc'
  - Import all services and create instances
  - Call `registerAllHandlers` with service instances
- Smart AI can write this wiring code.

### STEP 4 — Hooks + Store (Cheap Coders)
- **File:** `prompts/STEP4_HOOKS_STORE.md`
- **AI:** Haiku (H1, ST1), Flash (H2-H5)
- **Produces:** 6 files
- **Parallel:** All 6 at once
- **Review:** Review prompt at bottom of file
- **Time:** ~5 minutes

### STEP 5 — Components (Cheap Coders)
- **File:** `prompts/STEP5_COMPONENTS.md`
- **AI:** Flash (C1-C6, D1-D10), Haiku (M1-M3)
- **Produces:** 19 component files
- **Parallel:** All 19 at once
- **Review:** Review prompt at bottom of file
- **Time:** ~10 minutes

### STEP 6 — Pages (Cheap Coders)
- **File:** `prompts/STEP6_PAGES.md`
- **AI:** Flash (P1-P4, P6, P8-P10), Haiku (P5, P7)
- **Produces:** 10 page files
- **Parallel:** All 10 at once
- **Review:** Review prompt at bottom of file
- **Time:** ~10 minutes

### After Step 6:
- Update `App.tsx` router to import actual page components instead of placeholders
- Smart AI can do this (just import swaps)

---

### STEP 7 — Integration Test
- Run `npm run build`
- Run `npm start`
- If compile errors: paste into smart AI
- Manual test:
  - [ ] App opens
  - [ ] Sidebar navigation works
  - [ ] Can create a project
  - [ ] Can create a task
  - [ ] Can see task board with kanban columns
  - [ ] Settings page loads
  - [ ] Agent library shows hardcoded agents
  - [ ] Knowledge center shows empty state

---

## Total estimated time: 1-2 hours
## Total estimated AI cost: $2-4

## Parallel execution map (for maximum speed)

```
Minute 0-5:    STEP 1A (Sonnet) + STEP 1B (ChatGPT 5.4)
Minute 5-10:   STEP 1C review + fix issues + npm install
Minute 10-20:  STEP 2 services (9 cheap coder sessions)
Minute 20-25:  STEP 2 review + STEP 3 IPC (7 sessions)
Minute 25-30:  STEP 3 review + STEP 4 hooks (6 sessions)
Minute 30-35:  STEP 4 review + wire up main/index.ts
Minute 35-50:  STEP 5 components (19 sessions — batch if your tool limits concurrency)
Minute 50-55:  STEP 5 review
Minute 55-70:  STEP 6 pages (10 sessions)
Minute 70-75:  STEP 6 review + router update
Minute 75-90:  STEP 7 integration test + fix compile errors
```

## When things go wrong

| Problem | Action |
|---------|--------|
| Cheap coder adds features not in spec | Reject. Re-send same prompt to different cheap model. |
| Cheap coder hallucinates imports | Send compile error back to same coder: "Fix this error: {error}" |
| Type mismatch between service and hook | Smart AI: "These two files have a type mismatch. Fix the hook to match the service." |
| Compile error after integration | Paste full error into smart AI with both files involved |
| App opens but page is blank | Check browser console (Ctrl+Shift+I). Paste error into smart AI. |
| IPC calls return undefined | Check channel names match between preload, IPC handler, and hook |
| Two cheap coders used different patterns | Smart AI picks the better pattern, sends correction to the other |
