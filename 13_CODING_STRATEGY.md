# Coding Strategy — Smart Guardrails, Cheap Coders

## 1. The Split

Two tiers of AI, strict separation of duties.

**Smart brain** (Claude Opus/Sonnet, Gemini Pro):
- Architecture decisions
- Task decomposition into coder-sized chunks
- Prompt compilation for cheap coders
- Code review and rejection
- Closure and decision anchors
- Conflict resolution summaries
- Any reasoning that requires understanding the whole system

**Cheap hands** (Gemini Flash, Claude Haiku, Codestral):
- Writing code from ultra-specific instructions
- One file or one component at a time
- No architecture decisions
- No scope expansion
- No creative problem-solving
- Just translate the spec into code

The smart brain never writes production code. The cheap coder never makes design decisions.

## 2. Why This Works

Cheap coders fail at:
- holding large context
- maintaining consistency across files
- knowing when NOT to do something
- architecture reasoning

Cheap coders are fine at:
- writing a single React component from a spec
- implementing a function with defined inputs/outputs
- following a strict template
- boilerplate and repetitive patterns

The strategy is: decompose every task until each piece is something a cheap coder can't mess up. The smart brain does the decomposition. The cheap coder does the typing.

## 3. Model Routing Rules

### Smart brain tasks (use Claude Opus/Sonnet or Gemini Pro)
| Task | Model | Why |
|------|-------|-----|
| Initial architecture planning | Opus or Gemini Pro | Needs full system understanding |
| Task decomposition | Sonnet or Gemini Pro | Needs to understand boundaries |
| Code review | Sonnet | Good at spotting drift and scope creep |
| Prompt compilation | Sonnet | Needs to assemble context correctly |
| Conflict resolution | Opus or Gemini Pro | Needs nuanced reasoning |
| Closure / decision anchors | Sonnet | Structured output, consistent format |
| Debugging failures | Opus or Gemini Pro | Needs to reason about what went wrong |

### Cheap coder tasks (use Flash, Haiku, or Codestral)
| Task | Best cheap model | Why |
|------|-----------------|-----|
| React components from spec | Gemini Flash | Fast, good at React boilerplate |
| Electron IPC handlers | Codestral | Good at typed function implementations |
| Utility functions | Haiku | Clean, minimal output |
| JSON schema validators | Any | Mechanical translation |
| CSS/Tailwind styling | Gemini Flash | Fast at visual code |
| File I/O functions | Codestral | Good at Node.js patterns |
| Test files | Haiku | Concise, follows patterns |
| Data model types/interfaces | Any | Direct translation from spec |

### Routing decision tree
```
Is it a planning/review/architecture task?
  YES -> Smart brain (Opus/Sonnet/Gemini Pro)
  NO -> Does it touch more than 2 files?
    YES -> Smart brain decomposes it first, then cheap coders per file
    NO -> Does it require understanding system-wide state?
      YES -> Smart brain
      NO -> Cheap coder (Flash/Haiku/Codestral)
```

## 4. Cheap Coder Prompt Format

The key insight: cheap coders need **zero ambiguity**. Every prompt to a cheap coder must be a complete, self-contained instruction set. No "figure it out" — everything is spelled out.

### Template: Single Component

```markdown
# TASK: Create {ComponentName}

## YOUR ROLE
You are a code writer. Follow these instructions exactly. Do not add features, do not refactor, do not suggest improvements. Write exactly what is specified.

## TECH STACK
- React 18 with TypeScript
- Electron 28+
- Tailwind CSS for styling
- No additional libraries unless specified below

## FILE TO CREATE
`src/renderer/components/{path}/{ComponentName}.tsx`

## PROPS INTERFACE
{exact TypeScript interface}

## BEHAVIOR
{numbered list of exactly what this component does}

1. {behavior 1}
2. {behavior 2}
3. {behavior 3}

## STATE
{exact state variables with types and initial values}

## RENDERS
{exact description of what the component renders}

## DOES NOT
- Does not fetch data (data comes via props)
- Does not modify global state
- Does not navigate to other pages
- Does not {specific thing this component must not do}

## EXAMPLE USAGE
```tsx
<{ComponentName} {prop1}={value1} {prop2}={value2} />
```

## ARTIFACT WRITE INSTRUCTIONS — REQUIRED
{standard artifact tail}
```

### Template: Single Function/Module

```markdown
# TASK: Implement {functionName}

## YOUR ROLE
You are a code writer. Follow these instructions exactly.

## FILE TO CREATE
`src/main/{path}/{fileName}.ts`

## FUNCTION SIGNATURE
```typescript
{exact function signature with types}
```

## INPUTS
{description of each parameter}

## OUTPUTS
{exact return type and what each field means}

## LOGIC (step by step)
1. {step 1}
2. {step 2}
3. {step 3}

## ERROR HANDLING
- If {condition}: throw {ErrorType} with message "{message}"
- If {condition}: return {fallback value}

## DOES NOT
- Does not access the network
- Does not modify files outside {specific path}
- Does not {specific constraint}

## TEST CASES (the function must pass these)
- Input: {x} -> Output: {y}
- Input: {a} -> Output: {b}
- Input: {edge case} -> Output: {expected}

## ARTIFACT WRITE INSTRUCTIONS — REQUIRED
{standard artifact tail}
```

### Template: Electron IPC Handler

```markdown
# TASK: Implement IPC handler for {channelName}

## YOUR ROLE
You are a code writer. Follow these instructions exactly.

## FILE TO MODIFY
`src/main/ipc/{handlerFile}.ts`

## CHANNEL NAME
`{channelName}`

## DIRECTION
{main-to-renderer | renderer-to-main | bidirectional}

## REQUEST PAYLOAD
```typescript
{exact TypeScript type}
```

## RESPONSE PAYLOAD
```typescript
{exact TypeScript type}
```

## HANDLER LOGIC
1. {step 1}
2. {step 2}

## FILE SYSTEM OPERATIONS (if any)
- Reads from: {paths}
- Writes to: {paths}
- Creates: {paths}

## ARTIFACT WRITE INSTRUCTIONS — REQUIRED
{standard artifact tail}
```

## 5. The Cheap Coder Pipeline

For every coding task, the flow is:

```
Smart Brain (Planner)
  -> Decomposes task into single-file chunks
  -> Writes one cheap-coder prompt per chunk
  -> Specifies exact file paths, interfaces, behavior

Cheap Coder (Flash/Haiku/Codestral)
  -> Receives one prompt
  -> Writes one file + artifacts
  -> Cannot see other files (by design)

Smart Brain (Reviewer)
  -> Reviews each cheap coder output against the spec
  -> Checks: correct file path? correct interface? correct behavior? no extras?
  -> Approve / Revise / Reject

If Revise:
  Smart Brain writes a correction prompt with:
  - what was wrong
  - the exact fix needed
  - the original spec (repeated)
  -> Back to cheap coder

If Reject:
  Smart Brain rewrites the prompt with more detail
  -> Back to cheap coder (possibly different model)
```

### Retry budget
- Max 2 retries per cheap coder chunk
- If 2 retries fail: escalate to smart brain to write that chunk directly
- Track which task types consistently fail on which cheap models (this feeds back into routing)

## 6. Anti-Drift Rules for Cheap Coders

These are baked into every cheap coder prompt:

1. **One file only** — do not create additional files
2. **No imports you weren't told about** — if a library isn't in the spec, don't use it
3. **No architecture opinions** — if the spec says to do it a certain way, do it that way
4. **No helpful extras** — do not add error boundaries, analytics, logging, comments beyond JSDoc, or any feature not in the spec
5. **No refactoring** — if existing code is ugly, leave it ugly
6. **Exact file path** — write to exactly the path specified, not a "better" location
7. **Exact interface** — match the TypeScript interface exactly, no extra optional fields
8. **Artifacts are mandatory** — even for tiny tasks

## 7. Smart Brain Review Checklist (for cheap coder output)

The smart brain reviewer checks:

1. **File path correct?** — did it write to the specified path?
2. **Interface match?** — do props/params/return types match the spec exactly?
3. **No extras?** — did it add anything not in the spec?
4. **No missing pieces?** — did it implement everything in the spec?
5. **No hallucinated imports?** — is it importing libraries that don't exist or weren't specified?
6. **No scope creep?** — is it touching concerns outside its spec?
7. **Artifacts present?** — did it write all required artifact files?
8. **Artifacts valid?** — do artifacts pass schema validation?

If any check fails: revise with specific correction.

## 8. Electron + React Build Decomposition

### Project structure the smart brain defines upfront:

```
command-and-conquer/
  package.json
  electron-builder.json
  tsconfig.json
  src/
    main/                          # Electron main process
      index.ts                     # App entry point
      ipc/                         # IPC handlers (one file per domain)
        projects.ipc.ts
        tasks.ipc.ts
        runs.ipc.ts
        knowledge.ipc.ts
        prompts.ipc.ts
        settings.ipc.ts
      services/                    # Business logic (one file per domain)
        project.service.ts
        task.service.ts
        run-importer.service.ts
        knowledge.service.ts
        prompt-compiler.service.ts
        closure.service.ts
        conflict.service.ts
        watcher.service.ts         # File system watcher for artifact import
        obsidian-bridge.service.ts  # Writes to Obsidian vault
      storage/                     # File I/O layer
        file-store.ts              # Read/write JSON and markdown
        schema-validator.ts        # Validate against JSON schemas
      types/                       # Shared TypeScript types
        project.types.ts
        task.types.ts
        run.types.ts
        knowledge.types.ts
        agent.types.ts
        anchor.types.ts
        closure.types.ts
        conflict.types.ts
    renderer/                      # React UI
      App.tsx
      router.tsx
      pages/
        Dashboard.tsx
        Projects.tsx
        ProjectDetail.tsx
        TaskBoard.tsx
        PromptBuilder.tsx
        RunImporter.tsx
        ReviewPanel.tsx
        KnowledgeCenter.tsx
        AgentLibrary.tsx
        Settings.tsx
      components/
        layout/
          Sidebar.tsx
          Header.tsx
          HealthBadge.tsx
        tasks/
          TaskCard.tsx
          TaskDetail.tsx
          SizeSelector.tsx
        runs/
          RunCard.tsx
          ArtifactViewer.tsx
        knowledge/
          DocCard.tsx
          FreshnessIndicator.tsx
          ConflictPanel.tsx
        prompts/
          PromptPreview.tsx
          ArtifactTailBlock.tsx
        modals/
          DecisionAnchorGate.tsx
          ClosureModal.tsx
          ConflictResolutionModal.tsx
        common/
          StatusPicker.tsx
          ConfirmButton.tsx
          SearchBar.tsx
      hooks/
        useIPC.ts                  # Generic IPC hook
        useProjects.ts
        useTasks.ts
        useRuns.ts
        useKnowledge.ts
      stores/                      # React context or zustand
        app.store.ts
    preload/
      preload.ts                   # Electron preload script
      api.ts                       # Exposed IPC API
```

### Decomposition into cheap-coder chunks:

**Phase 1 — Foundation (smart brain writes these directly)**
The smart brain writes the scaffolding that cheap coders build on:
- package.json with all dependencies
- tsconfig.json
- electron-builder.json
- src/main/index.ts (Electron entry)
- src/preload/preload.ts and api.ts
- src/renderer/App.tsx and router.tsx
- src/main/types/*.ts (all type definitions — these ARE the spec)
- src/main/storage/file-store.ts (core file I/O — too important for cheap coder)
- src/main/storage/schema-validator.ts

Why smart brain writes these: they define the contracts everything else depends on. If these are wrong, everything downstream fails. Worth the token spend.

**Phase 1 — Cheap coder chunks (one prompt each)**
After foundation is laid, cheap coders build out:
1. Each IPC handler file (6 files, 6 prompts)
2. Each service file (9 files, 9 prompts)
3. Each page component (10 files, 10 prompts)
4. Each UI component (15-20 files, 15-20 prompts)
5. Each hook (5 files, 5 prompts)
6. Store setup (1 file, 1 prompt)

Total: ~50 cheap coder prompts for Phase 1, each producing one file.

**Smart brain review after each batch:**
- Review all IPC handlers together (are channels consistent?)
- Review all services together (do they use file-store correctly?)
- Review pages against screen map (do they match the spec?)
- Review components against pages (do props align?)

## 9. Cost Estimate

Rough per-file costs at current pricing (March 2026):

| Model | Role | Input tokens | Output tokens | Cost per chunk |
|-------|------|-------------|---------------|----------------|
| Claude Opus | Planning/Review | ~4K | ~2K | ~$0.10 |
| Claude Sonnet | Review/Compile | ~4K | ~1K | ~$0.03 |
| Gemini Pro | Planning | ~4K | ~2K | ~$0.04 |
| Gemini Flash | Coding | ~2K | ~2K | ~$0.001 |
| Claude Haiku | Coding | ~2K | ~2K | ~$0.003 |
| Codestral | Coding | ~2K | ~2K | ~$0.002 |

For Phase 1 (~50 cheap coder chunks + smart brain overhead):
- Smart brain: ~20 planning/review calls = ~$1-2
- Cheap coders: ~50 coding calls = ~$0.10-0.15
- Retries (assume 20%): ~$0.03
- **Total Phase 1 estimate: ~$2-3**

Compare to using Opus for everything: ~$5-10 for the same work, with no better quality on the mechanical coding tasks.

## 10. Failure Modes and Mitigations

| Failure | Symptom | Mitigation |
|---------|---------|------------|
| Cheap coder ignores interface spec | Wrong prop types, extra fields | Automated TypeScript compile check before review |
| Cheap coder adds unwanted features | Extra buttons, analytics, logging | Review checklist item: "no extras" |
| Cheap coder hallucinates imports | Import from packages not in package.json | Automated import check against package.json |
| Cheap coder can't handle Electron IPC | Wrong patterns, security issues | Route all IPC to Codestral (best at typed Node.js) |
| Cheap coder produces broken JSX | Syntax errors, unclosed tags | Automated lint/compile check |
| Cheap coder drifts from naming conventions | camelCase vs snake_case mix | Include naming rules in every prompt header |
| Multiple retries still fail | 2+ rejections on same chunk | Auto-escalate to smart brain for that chunk |

### Automated pre-review checks (run before smart brain review)
1. `tsc --noEmit` — does it compile?
2. `eslint {file}` — does it lint?
3. Check imports against package.json
4. Check file written to correct path
5. Check artifacts exist and validate against schemas

If any automated check fails: send error output back to cheap coder with fix instructions (no smart brain needed for syntax fixes).
