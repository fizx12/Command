import { FileStore } from '../storage/file-store';
import { TaskService } from './task.service';
import { PromptStack, CompiledPrompt, AgentMode, PromptStep, Task, TaskMode } from '../types';
import { validateArchitectOutput, checkNoArchitectResidue, PromptValidationResult } from './prompt-validator.service';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ParsedArchitectDelta {
  level: 'FULL' | 'LIGHTWEIGHT' | 'SKELETON' | 'UNKNOWN';
  reason: string;
  enhancements: string;
  removeBlock: string;
  replaceBlock: string;
  addBlock: string;
  filePlanBlock: string;
  coderGuardrailsBlock: string;
  blockersBlock: string;
  warnings: string[];
  invalidReasons: string[];
  valid: boolean;
}

export class PromptCompilerService {
  private static readonly CHIEF_ARCHITECT_STRING = `# SYSTEM DIRECTIVE: CHIEF ARCHITECT

  
  You produce literal, file-level implementation plans for a weak coding agent. The agent cannot infer, improvise, or read between the lines. Every instruction you give must be exact and self-contained.
  All code must be placed in a code block for easy copy and paste.
## CONTEXT MODES
- **MAX** — Full context stack provided: task spec, app primer, source of truth index, and any carry-forward history. Use all of it. Do not reference documents not provided.
- **WeakSAUCE** — Only the task spec is provided. Plan using only what is in the task spec. Do not assume any file, path, API, or pattern exists unless the task spec states it.

## RULE 1: NEVER GUESS — ASK OR OMIT
This is the most important rule. If any fact is not explicitly present in the provided context:
- Do NOT invent file paths, directory structures, component names, function signatures, env vars, scripts, CLI commands, API endpoints, or database schemas.
- Do NOT assume a file exists unless it is named in the task spec, app primer, or source of truth.
- If the information is required to complete a phase, write: **[UNKNOWN: describe what is missing]** and move on.
- If the missing information blocks the entire plan, state what is missing at the top under a ## BLOCKING UNKNOWNS heading and stop.
- Prefer omission over invention. A plan with gaps is better than a plan with hallucinated details.

## RULE 2: ZERO AMBIGUITY
- Never write "update the UI" or "modify the service." Name the exact file path, the exact function or component, and the exact change.
- Every checklist item must answer: which file, what action, what content (or what content to remove).
- If a checklist item cannot name a specific file, it is too vague. Rewrite it or flag it as [UNKNOWN].

## RULE 3: STRICT GUARDRAILS
- The task spec defines Scope (files that MUST change), Out of Scope (files that MUST NOT change), and Must Preserve (behaviors/invariants that MUST NOT break).
- Your plan MUST NOT touch any file listed in Out of Scope.
- Your plan MUST NOT break any item listed in Must Preserve.
- Your plan MUST NOT refactor, rename, reformat, or "improve" anything not explicitly required by the task.
- If a change seems helpful but is not in scope, do not include it.

## RULE 4: DEPENDENCY ORDER
- Plan changes in dependency order: types/interfaces before services, services before UI, shared before consumer.
- If the task is not a code task (documentation, config, etc.), use phases appropriate to that task type instead. Do not force code-build phases onto non-code work.

## RULE 5: SOURCE MATERIAL LOCKDOWN
- Your only source of truth is the context provided in this prompt: the task spec, the app primer (if provided), and the source of truth index (if provided).
- Do NOT reference files, modules, or patterns you "know" from training data but that are not in the provided context.
- Do NOT invent setup commands, install steps, migration scripts, or deployment workflows unless the task spec explicitly requests them.
- If the task spec says "Synthesize from provided context," that means use ONLY the provided context, not your own knowledge of similar projects.
- For every file path in your checklist, annotate it with one of: [FROM CONTEXT] if it appears in the provided source of truth or app primer, or [INSPECT FIRST] if you believe it should exist but it is not explicitly named in the provided context. The executor must verify any [INSPECT FIRST] path exists before modifying it.

## RULE 6: STOP BEFORE LARGE CHANGES
- If your plan requires changing more than 5 files, add a ## SCALE WARNING at the top listing every file and the reason it must change. The operator will review before the executor begins.
- If your plan requires creating more than 2 new files, add a ## NEW FILES WARNING listing each new file path and its purpose.

---

### OUTPUT FORMAT
Output ONLY the following sections in this exact order. No preamble, no conversational text, no summaries.

**Section 1:** Reproduce the # TASK SPECIFICATION from the context above — verbatim, unchanged. Do not rewrite, summarize, or add to it.

**Section 2:** Output the planner phases as # PLANNER OUTPUT.

Choose phases appropriate to the task type:

For code tasks (new features, bug fixes, refactors):
* **Phase 1: Types & Interfaces** — type definitions, interface changes, shared constants
* **Phase 2: Services & Logic** — backend services, IPC handlers, data layer
* **Phase 3: UI & Integration** — components, routes, wiring
* **Phase 4: Verification** — confirm scope respected, must-preserve intact, no out-of-scope files touched

For documentation tasks (README, docs, knowledge base):
* **Phase 1: Document Structure** — outline, section order, file paths
* **Phase 2: Content Synthesis** — write content using ONLY provided context
* **Phase 3: Cross-References** — links, index updates, related file updates
* **Phase 4: Verification** — confirm no invented content, all sources from provided context

For mixed tasks, combine phases as needed but always end with Verification.

Each phase must contain a checklist of specific actions. Each checklist item must be a checkbox line:
* [ ] In \\\`<exact-file-path>\\\`: <exact action to take>

Do not include prose paragraphs inside phases. Do not include code snippets or diffs. Do not include examples. Only checklist items.

If any checklist item cannot name a file, mark it: * [ ] [UNKNOWN: <what is needed>]

**Section 3 (only if needed):** ## BLOCKING UNKNOWNS — list facts required to complete the plan that are not in the provided context.

**Section 4 (only if needed):** ## SCALE WARNING — list all files to be changed if more than 5, or ## NEW FILES WARNING if creating more than 2 new files.`;

  private fileStore: FileStore;
  private taskService?: TaskService;

  constructor(fileStore: FileStore, taskService?: TaskService) {
    this.fileStore = fileStore;
    this.taskService = taskService;
  }

  private buildPrecedenceBlock(): string {
    return `# AUTHORITY HIERARCHY — CONFLICT RESOLUTION

If any two sections contradict, resolve by this precedence (1 = highest):

1. OUTPUT LOCATION — run ID, task ID, output path, 5 artifact filenames are absolute and immutable
2. TASK SPECIFICATION — title, objective, scope, out-of-scope, must-preserve define the mission
3. Out-of-scope + Must-preserve — these are hard constraints, never overridden by planner or context
4. STEP: IMPLEMENT phases — the execution structure you must follow
5. PLANNER OUTPUT — the file-level plan; subordinate to task spec if they conflict
6. SOURCE OF TRUTH / APP PRIMER — codebase context; informational, not authoritative over task spec
7. GLOBAL RULES / MASTER PROMPT — behavioral defaults; lowest priority`;
  }

  private buildTaskModeBlock(taskMode: TaskMode): string {
    if (taskMode === 'implement') return '';

    if (taskMode === 'audit') {
      return `# EXECUTION MODE
This is an audit-only task.

For this run:
- Do not modify source files.
- Do not rename anything.
- Do not change UI, layout, styling, text, routes, imports, exports, or logic.
- Read and compare scoped files only.
- Phase 2: Execution means inspect/analyze only; it does not authorize code edits.
- Success for this run is findings, discrepancies, risks, and a file-level follow-up action plan only.
- If fixes are needed, do not make them in this run.
- changed_files.json must be [] if no files were modified.
- code_snippets.md may include existing code excerpts for review, not newly authored code.`;
    }

    return `# TASK MODE: REGRESSION FOCUSED

This run is regression analysis first.
Identify expected-versus-current mismatches.
Identify likely regression points in scoped files only.
Prefer the smallest safe fix plan.
Do not widen scope.
Do not refactor unless explicitly requested.`;
  }

  async compile(projectId: string, taskId: string, step: PromptStep, mode: AgentMode, taskMode: TaskMode = 'implement'): Promise<CompiledPrompt> {
    // Generate run ID at compile time — baked into the prompt so AI knows where to write
    const runId = 'RUN-' + String(Date.now()).slice(-6);

    // Determine the absolute output path for this run.
    // Hub mode (preferred): {hubPath}/runs/{projectId}/{runId}/
    //   — One hub folder holds ALL projects' runs. The AI is given the full absolute path.
    // Legacy fallback: internal workspace path (used if hubPath not configured in settings).
    let absoluteOutputPath: string;
    try {
      const settings = await this.fileStore.readJSON<{ hubPath?: string }>('system/settings.json');
      if (settings?.hubPath?.trim()) {
        absoluteOutputPath = path.join(settings.hubPath.trim(), 'runs', projectId, runId);
      } else {
        absoluteOutputPath = this.fileStore.resolvePath(`workspace/projects/${projectId}/runs/${runId}`);
      }
    } catch {
      absoluteOutputPath = this.fileStore.resolvePath(`workspace/projects/${projectId}/runs/${runId}`);
    }

    let globalRules = '';
    let masterPrompt = '';
    let projectPrimer = '';
    let sourceOfTruth = '';
    let repoContext = '';
    let taskSpecStr = '';
    let taskSpec: Task | null = null;
    let plannerOutput = '';
    let carryForward = '';
    let outputFormat = '';

    try { globalRules = await this.fileStore.readMarkdown('system/GLOBAL_RULES.md'); } catch { /* missing */ }
    try { masterPrompt = await this.fileStore.readMarkdown('system/MASTER_PROMPT.md'); } catch { /* missing */ }
    try { projectPrimer = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/knowledge/docs/APP_PRIMER.md`); } catch { /* missing */ }
    try { sourceOfTruth = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/knowledge/docs/SOURCE_OF_TRUTH_INDEX.md`); } catch { /* missing */ }
    try { repoContext = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/knowledge/docs/REPO_CONTEXT.md`); } catch { /* missing — only present after Generate Context */ }

    try {
      taskSpec = await this.fileStore.readJSON<Task>(`workspace/projects/${projectId}/tasks/${taskId}/task_spec.json`);
      if (taskSpec) taskSpecStr = this.taskSpecToMarkdown(taskSpec);
    } catch { /* missing */ }

    try { plannerOutput = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/tasks/${taskId}/planner_output.md`); } catch { /* missing */ }
    try { carryForward = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/tasks/${taskId}/carry_forward.md`); } catch { /* missing */ }

    try { outputFormat = await this.fileStore.readMarkdown('system/OUTPUT_FORMAT.md'); } catch { /* missing */ }
    // NOTE: ARTIFACT_TAIL is intentionally NOT included — OUTPUT_FORMAT already contains
    // the full schemas. Including both doubles the token count with identical content.

    // Output location block — injected at end of every compiled prompt
    const outputLocationBlock = `# OUTPUT LOCATION — REQUIRED

Write ALL 5 artifact files to this EXACT absolute folder path:

\`\`\`
${absoluteOutputPath}
\`\`\`

**Run ID:** \`${runId}\`
**Project:** \`${projectId}\`
**Task:** \`${taskId}\`

This is an absolute path on the filesystem. Create the folder if it does not exist. Write all 5 files into this exact folder:
- job_result.json
- changed_files.json
- review_checklist.json
- job_summary.md
- code_snippets.md

Do NOT use a relative path. Do NOT guess a path. Use ONLY the exact absolute path shown above.
The Command & Conquer orchestrator monitors this exact path and will auto-import your run the moment all 5 files appear.

IMPORTANT: Your job_result.json MUST include these two fields exactly as shown:
\`\`\`json
"task_id": "${taskId}",
"run_id": "${runId}"
\`\`\``;

    const sections: string[] = [];
    sections.push(this.buildPrecedenceBlock());

    // â”€â”€ TASK SPEC ALWAYS FIRST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Put the "what" before the "how". The coder sees the objective immediately.
    // Empty sections are intentionally omitted — no filler content.
    if (taskSpecStr) sections.push(taskSpecStr);
    // plannerOutput only flows into implement step (plan step produces it)
    if (step === 'implement' && plannerOutput) sections.push(plannerOutput);
    if (carryForward) sections.push(carryForward);
    const taskModeBlock = this.buildTaskModeBlock(taskMode);
    if (taskModeBlock) sections.push(taskModeBlock);

    if (mode === 'WeakSAUCE') {
      // Thin stack — task + directive only, no global context
      if (masterPrompt) sections.push(masterPrompt + `\n\n**CURRENT AGENT MODE:** ${mode}`);
      if (outputFormat) sections.push(outputFormat);
    } else {
      // MAX stack — full context follows the task spec
      if (globalRules) sections.push(globalRules);
      // Append the live mode so the agent knows exactly which behavioral ruleset applies.
      // This line is protected from stripModeReferences() via the PRESERVE guard.
      if (masterPrompt) sections.push(masterPrompt + `\n\n**CURRENT AGENT MODE:** ${mode}`);
      if (projectPrimer) sections.push(projectPrimer);
      if (sourceOfTruth) sections.push(sourceOfTruth);
      if (repoContext) sections.push(repoContext);
      if (outputFormat) sections.push(outputFormat);
    }

    // â”€â”€ STEP INSTRUCTION ALWAYS LAST (before output location) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Phased checklist: forces the AI to plan â†’ implement â†’ self-review â†’ artifacts.
    // hasPlannerOutput controls whether the "follow the plan" reference appears.
    const hasPlannerOutput = !!(step === 'implement' && plannerOutput);
    const stepInstruction = this.buildTaskModeStepInstruction(step, hasPlannerOutput, taskMode);
    sections.push(stepInstruction);

    // Output location always goes last
    sections.push(outputLocationBlock);

    // Join and strip any MAX/WeakSAUCE mode references that leak in from system files.
    // Mode only controls what the prompt compiler includes — the AI coder never needs to know about it.
    const rawText = sections.join('\n\n---\n\n');
    const compiledText = this.stripModeReferences(rawText);
    const tokenEstimate = Math.ceil(compiledText.length / 4);

    // Save the compiled prompt to disk so it can be viewed alongside the run later.
    // No placeholder run.meta.json is created here — creating one for every compile
    // floods run history with phantom entries every time the user tweaks a prompt.
    // The real run.meta.json is written by the watcher when actual artifacts arrive.
    const promptPath = `workspace/projects/${projectId}/tasks/${taskId}/prompts/PROMPT-${runId}.md`;
    try {
      await this.fileStore.writeMarkdown(promptPath, compiledText);
    } catch { /* non-fatal — prompt history is best-effort */ }

    return {
      id: 'COMP-' + crypto.randomUUID().slice(0, 8),
      projectId,
      taskId,
      agentId: step, // backward compat
      step,
      mode,
      compiledText,
      tokenEstimate,
      createdAt: new Date().toISOString(),
      pendingRunId: runId,
      promptPath,
    } as CompiledPrompt & { pendingRunId: string; promptPath: string };
  }

  async preview(projectId: string, taskId: string, step: PromptStep, mode: AgentMode, taskMode: TaskMode = 'implement'): Promise<string> {
    const compiled = await this.compile(projectId, taskId, step, mode, taskMode);
    return compiled.compiledText;
  }

  /**
   * Builds the Chief Architect payload: task spec + codebase context docs + architect persona.
   * This gets pasted into a smart LLM (GPT-5.4) to produce a precise implementation plan.
   */
  async buildArchitectPayload(projectId: string, taskId: string, targetCoder: '5.4mini' | 'flash' = '5.4mini', taskMode: TaskMode = 'implement'): Promise<string> {
    let taskSpecStr = '';
    let projectPrimer = '';
    let sourceOfTruth = '';

    // Use TaskService when available — it's the same proven path that populates the UI task list.
    // If the task genuinely can't be found, throw so the renderer falls back to its own data fetch.
    if (this.taskService) {
      const taskSpec = await this.taskService.getTask(projectId, taskId);
      if (!taskSpec) throw new Error(`Task not found: ${taskId}`);
      taskSpecStr = this.taskSpecToMarkdown(taskSpec);
    } else {
      try {
        const taskSpec = await this.fileStore.readJSON<any>(`workspace/projects/${projectId}/tasks/${taskId}/task_spec.json`);
        if (taskSpec) taskSpecStr = this.taskSpecToMarkdown(taskSpec);
      } catch { /* missing */ }
      if (!taskSpecStr) throw new Error(`Task not found: ${taskId}`);
    }

    try { projectPrimer = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/knowledge/docs/APP_PRIMER.md`); } catch { /* missing */ }
    try { sourceOfTruth = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/knowledge/docs/SOURCE_OF_TRUTH_INDEX.md`); } catch { /* missing */ }

    const sections: string[] = [PromptCompilerService.CHIEF_ARCHITECT_STRING];
    sections.push('---CONTEXT FOR THE ARCHITECT---');
    if (taskSpecStr) sections.push(taskSpecStr);
    if (projectPrimer) sections.push(projectPrimer);
    if (sourceOfTruth) sections.push(sourceOfTruth);
    const taskModeBlock = this.buildTaskModeBlock(taskMode);
    if (taskModeBlock) sections.push(taskModeBlock);

    if (targetCoder === 'flash') {
      sections.push(`---FLASH EDIT CONTRACT---


YOU ARE BUILDING A CODING PROMPT FOR GEMINI FLASH
Tailor all improvements specifically for Gemini Flash.
Gemini Flash is fast and literal; prefer short exact instructions, hard boundaries, and direct file-by-file actions.
Any model-specific rules that must survive into the final coder prompt MUST be emitted inside CODER_GUARDRAILS, FILE_PLAN, or BLOCKERS; do not rely on wrapper text alone.

When the task mode is not implement, keep the coder contract aligned with it:
- audit: forbid code edits, renames, and any implementation work; return findings only
- regression: focus on the smallest safe fix path; do not widen scope or refactor

Emit a short EDIT CONTRACT inside CODER_GUARDRAILS using these exact bullet labels:
- allowed_change_types: ...
- forbidden_change_types: ..., rename_symbols, rename_routes, rename_labels
- ui_change_mode: ...
- stop_if_needed: renames required but not explicitly requested

Derive the EDIT CONTRACT from the task using these rules:
- If the task is bug, wiring, restore, or fix behavior only: allowed_change_types = logic, ui_wiring; forbidden_change_types = style, layout, text_copy, new_files, refactor, rename_symbols, rename_routes, rename_labels; ui_change_mode = none.
- If the task explicitly mentions labels, copy, tooltips, text, or help text: allow text_copy; allow style only if style files are in scope or style is explicitly requested; forbid layout unless explicitly requested; ui_change_mode = copy_only or style_only.
- If the task explicitly mentions style, restyle, visual, theme, or tooltip styling: allow style; allow layout only if layout, position, or structure is explicitly requested; ui_change_mode = style_only or layout_allowed.
- If the task explicitly mentions move, rearrange, layout, section placement, new flow, or new UI behavior: allow layout; still forbid refactor, new_files, and rename_symbols unless explicitly requested; ui_change_mode = layout_allowed or full_ui_in_scope.
- If Must Preserve says UI, layout, style, or text must remain: forbid matching change types even if the objective is broad.
- If scope excludes styling files and the task does not explicitly request UI changes: forbid style and layout; ui_change_mode = none.
- If required work exceeds allowed_change_types: stop and return partial instead of drifting.
- Do not rename any component, route, file, function, symbol, label, heading, or user-facing term unless the task explicitly says to rename it.
- "Consistency", "clarity", "better naming", or "match specifications" are NOT valid reasons to rename anything.
- Preserve all existing names and route paths unless the task explicitly includes the old name and the new name.
- If a rename seems required to complete the task, stop and return partial instead of renaming.
- Do not change URLs, route slugs, import names, export names, component names, tab labels, or button text unless explicitly requested in the task.
- If the task says to improve or align behavior, do that without renaming anything.
- Invalid drift example: renaming "Prompt Builder" to "Prompt Generator" because it feels more consistent.
`);
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * Takes the architect's output (pasted back from GPT-5.4) and fuses it with
   * execution boilerplate to produce a prompt for the dumb coding AI.
   *
   * The architect's plan replaces the task spec + planner output.
   * Everything else (rules, schemas, step checklist, output location) is appended.
   */
  async compileFromArchitectOutput(
    projectId: string,
    taskId: string,
    architectOutput: string
  ): Promise<CompiledPrompt> {
    const runId = 'RUN-' + String(Date.now()).slice(-6);

    let absoluteOutputPath: string;
    try {
      const settings = await this.fileStore.readJSON<{ hubPath?: string }>('system/settings.json');
      if (settings?.hubPath?.trim()) {
        absoluteOutputPath = path.join(settings.hubPath.trim(), 'runs', projectId, runId);
      } else {
        absoluteOutputPath = this.fileStore.resolvePath(`workspace/projects/${projectId}/runs/${runId}`);
      }
    } catch {
      absoluteOutputPath = this.fileStore.resolvePath(`workspace/projects/${projectId}/runs/${runId}`);
    }

    let taskSpecStr = '';
    let globalRules = '';
    let masterPrompt = '';
    let projectPrimer = '';
    let sourceOfTruth = '';
    let repoContext = '';
    let carryForward = '';
    let outputFormat = '';

    let loadedTask: Task | null = null;
    if (this.taskService) {
      const taskSpec = await this.taskService.getTask(projectId, taskId);
      if (taskSpec) { loadedTask = taskSpec; taskSpecStr = this.taskSpecToMarkdown(taskSpec); }
    } else {
      try {
        const taskSpec = await this.fileStore.readJSON<Task>(`workspace/projects/${projectId}/tasks/${taskId}/task_spec.json`);
        if (taskSpec) { loadedTask = taskSpec; taskSpecStr = this.taskSpecToMarkdown(taskSpec); }
      } catch { /* missing */ }
    }

    try { globalRules = await this.fileStore.readMarkdown('system/GLOBAL_RULES.md'); } catch { /* missing */ }
    try { masterPrompt = await this.fileStore.readMarkdown('system/MASTER_PROMPT.md'); } catch { /* missing */ }
    try { projectPrimer = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/knowledge/docs/APP_PRIMER.md`); } catch { /* missing */ }
    try { sourceOfTruth = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/knowledge/docs/SOURCE_OF_TRUTH_INDEX.md`); } catch { /* missing */ }
    try { repoContext = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/knowledge/docs/REPO_CONTEXT.md`); } catch { /* missing â€” optional */ }
    try { carryForward = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/tasks/${taskId}/carry_forward.md`); } catch { /* missing */ }
    try { outputFormat = await this.fileStore.readMarkdown('system/OUTPUT_FORMAT.md'); } catch { /* missing */ }

    const parsedArchitect = this.parseArchitectDelta(architectOutput);
    const patchedTaskSpec = parsedArchitect.valid
      ? this.applyArchitectDeltaToTaskSpec(taskSpecStr || '', parsedArchitect)
      : (taskSpecStr || '');

    // Validate architect output against original task spec before fusion
    let validationWarnings: string[] = [];
    if (loadedTask) {
      const validation = validateArchitectOutput(loadedTask, architectOutput);
      if (validation.hardFails.length > 0) {
        throw new Error('Architect output validation failed:\n' + validation.hardFails.join('\n'));
      }
      validationWarnings = validation.warnings;
    }

    const outputLocationBlock = `# OUTPUT LOCATION — REQUIRED

Write ALL 5 artifact files to this EXACT absolute folder path:

\`\`\`
${absoluteOutputPath}
\`\`\`

**Run ID:** \`${runId}\`
**Project:** \`${projectId}\`
**Task:** \`${taskId}\`

This is an absolute path on the filesystem. Create the folder if it does not exist. Write all 5 files into this exact folder:
- job_result.json
- changed_files.json
- review_checklist.json
- job_summary.md
- code_snippets.md

Do NOT use a relative path. Do NOT guess a path. Use ONLY the exact absolute path shown above.
The Command & Conquer orchestrator monitors this exact path and will auto-import your run the moment all 5 files appear.

IMPORTANT: Your job_result.json MUST include these two fields exactly as shown:
\`\`\`json
"task_id": "${taskId}",
"run_id": "${runId}"
\`\`\``;

    const sections: string[] = [];
    sections.push(this.buildPrecedenceBlock());
    if (patchedTaskSpec) sections.push(patchedTaskSpec);
    if (carryForward) sections.push(carryForward);

    if (globalRules) sections.push(globalRules);
    if (masterPrompt) sections.push(masterPrompt + `\n\n**CURRENT AGENT MODE:** MAX`);
    if (projectPrimer) sections.push(projectPrimer);
    if (sourceOfTruth) sections.push(sourceOfTruth);
    if (repoContext) sections.push(repoContext);
    if (outputFormat) sections.push(outputFormat);

    const stepInstruction = this.buildStepInstruction('implement', true);
    sections.push(stepInstruction);
    sections.push(outputLocationBlock);

    const rawText = sections.join('\n\n---\n\n');
    const compiledText = this.stripModeReferences(rawText);
    const tokenEstimate = Math.ceil(compiledText.length / 4);

    // Reject if architect system directive residue leaked into the executor prompt
    const residueCheck = checkNoArchitectResidue(compiledText);
    if (residueCheck.hardFails.length > 0) {
      throw new Error('Architect residue in fused executor prompt:\n' + residueCheck.hardFails.join('\n'));
    }

    const promptPath = `workspace/projects/${projectId}/tasks/${taskId}/prompts/PROMPT-${runId}.md`;
    try {
      await this.fileStore.writeMarkdown(promptPath, compiledText);
    } catch { /* non-fatal */ }

    // No placeholder run.meta.json is created here — creating one for every compile
    // floods run history with phantom entries every time the user tweaks a prompt.
    // The real run.meta.json is written by the watcher when actual artifacts arrive.

    return {
      id: 'COMP-' + crypto.randomUUID().slice(0, 8),
      projectId,
      taskId,
      agentId: 'implement',
      step: 'implement',
      mode: 'MAX',
      compiledText,
      tokenEstimate,
      createdAt: new Date().toISOString(),
      pendingRunId: runId,
      promptPath,
      validationWarnings,
    } as CompiledPrompt & { pendingRunId: string; promptPath: string };
  }

  private parseArchitectDelta(architectOutput: string): ParsedArchitectDelta {
    const warnings: string[] = [];
    const invalidReasons: string[] = [];
    const unwrapped = this.unwrapSingleFencedCodeBlock(architectOutput);
    const lines = unwrapped.split(/\r?\n/);

    const parsed: ParsedArchitectDelta = {
      level: 'UNKNOWN',
      reason: '',
      enhancements: '',
      removeBlock: '',
      replaceBlock: '',
      addBlock: '',
      filePlanBlock: '',
      coderGuardrailsBlock: '',
      blockersBlock: '',
      warnings,
      invalidReasons,
      valid: true,
    };

    let current:
      | 'enhancements'
      | 'reason'
      | 'removeBlock'
      | 'replaceBlock'
      | 'addBlock'
      | 'filePlanBlock'
      | 'coderGuardrailsBlock'
      | 'blockersBlock'
      | '' = '';
    let buffer: string[] = [];

    const flush = () => {
      if (!current) return;
      (parsed as any)[current] = buffer.join('\n').trim();
      buffer = [];
      current = '';
    };

    const startBlock = (key: typeof current, inlineValue: string) => {
      flush();
      current = key;
      if (inlineValue) buffer.push(inlineValue);
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') {
        if (current) buffer.push(line);
        continue;
      }

      const levelMatch = trimmed.match(/^===\s*LEVEL:\s*(FULL|LIGHTWEIGHT|SKELETON)\s*===$/i);
      if (levelMatch) {
        flush();
        parsed.level = levelMatch[1].toUpperCase() as ParsedArchitectDelta['level'];
        continue;
      }

      const enhMatch = trimmed.match(/^Enhancements:\s*(.*)$/i);
      if (enhMatch) {
        startBlock('enhancements', enhMatch[1]);
        continue;
      }

      const reasonMatch = trimmed.match(/^Reason:\s*(.*)$/i);
      if (reasonMatch) {
        startBlock('reason', reasonMatch[1]);
        continue;
      }

      const removeMatch = trimmed.match(/^---REMOVE---\s*(.*)$/i);
      if (removeMatch) {
        startBlock('removeBlock', removeMatch[1]);
        continue;
      }

      const replaceMatch = trimmed.match(/^---REPLACE---\s*(.*)$/i);
      if (replaceMatch) {
        startBlock('replaceBlock', replaceMatch[1]);
        continue;
      }

      const addMatch = trimmed.match(/^---ADD---\s*(.*)$/i);
      if (addMatch) {
        startBlock('addBlock', addMatch[1]);
        continue;
      }

      const filePlanMatch = trimmed.match(/^---FILE_PLAN---\s*(.*)$/i);
      if (filePlanMatch) {
        startBlock('filePlanBlock', filePlanMatch[1]);
        continue;
      }

      const guardrailsMatch = trimmed.match(/^---CODER_GUARDRAILS---\s*(.*)$/i);
      if (guardrailsMatch) {
        startBlock('coderGuardrailsBlock', guardrailsMatch[1]);
        continue;
      }

      const blockersMatch = trimmed.match(/^---BLOCKERS---\s*(.*)$/i);
      if (blockersMatch) {
        startBlock('blockersBlock', blockersMatch[1]);
        continue;
      }

      if (current) {
        buffer.push(line);
      } else {
        this.invalidateParsedArchitectDelta(parsed, `Unexpected content outside delta blocks: "${trimmed}"`);
      }
    }

    flush();

    if (!parsed.enhancements) warnings.push('Missing or empty Enhancements section');
    if (!parsed.reason) warnings.push('Missing or empty Reason section');
    if (parsed.level === 'UNKNOWN') warnings.push('Missing LEVEL section');
    if (!parsed.removeBlock) warnings.push('Missing REMOVE block');
    if (!parsed.replaceBlock) warnings.push('Missing REPLACE block');
    if (!parsed.addBlock) warnings.push('Missing ADD block');
    if (!parsed.filePlanBlock) warnings.push('Missing FILE_PLAN block');
    if (!parsed.coderGuardrailsBlock) warnings.push('Missing CODER_GUARDRAILS block');

    this.validateAddBlock(parsed);

    parsed.valid =
      parsed.invalidReasons.length === 0 &&
      parsed.level !== 'UNKNOWN' &&
      !!parsed.enhancements &&
      !!parsed.reason &&
      !!parsed.removeBlock &&
      !!parsed.replaceBlock &&
      !!parsed.addBlock &&
      !!parsed.filePlanBlock &&
      !!parsed.coderGuardrailsBlock;

    return parsed;
  }

  private unwrapSingleFencedCodeBlock(text: string): string {
    const trimmed = text.trim();
    const match = trimmed.match(/^```[^\r\n`]*\r?\n([\s\S]*?)\r?\n```\s*$/);
    return match ? match[1].trim() : trimmed;
  }

  private applyArchitectDeltaToTaskSpec(taskSpecText: string, parsed: ParsedArchitectDelta): string {
    let text = taskSpecText;
    text = this.applyRemoveEntries(text, parsed);
    text = this.applyReplaceEntries(text, parsed);
    text = this.applyAddEntries(text, parsed);
    return text;
  }

  private applyRemoveEntries(text: string, parsed: ParsedArchitectDelta): string {
    const entries = this.parseLineEntries(parsed.removeBlock);
    if (entries.length === 0) return text;

    const lines = text.split(/\r?\n/);
    for (const entry of entries) {
      if (this.isExplicitNone(entry)) continue;
      const target = entry.trim();
      const idx = lines.findIndex(line => line.trim() === target);
      if (idx === -1) {
        parsed.warnings.push(`REMOVE entry not found: "${target}"`);
        continue;
      }
      lines.splice(idx, 1);
    }
    return lines.join('\n');
  }

  private applyReplaceEntries(text: string, parsed: ParsedArchitectDelta): string {
    const entries = this.parseLineEntries(parsed.replaceBlock);
    if (entries.length === 0) return text;

    const lines = text.split(/\r?\n/);
    for (const entry of entries) {
      if (this.isExplicitNone(entry)) continue;
      const match = entry.match(/^(.*?)(?:\s*=>\s*)(.*)$/);
      if (!match) {
        parsed.warnings.push(`REPLACE entry is not in old => new format: "${entry}"`);
        continue;
      }
      const oldText = match[1].trim();
      const newText = match[2].trim();
      const idx = lines.findIndex(line => line.trim() === oldText);
      if (idx === -1) {
        parsed.warnings.push(`REPLACE target not found: "${oldText}"`);
        continue;
      }
      lines[idx] = newText;
    }
    return lines.join('\n');
  }

  private applyAddEntries(text: string, parsed: ParsedArchitectDelta): string {
    const entries = this.parseLineEntries(parsed.addBlock);
    if (entries.length === 0) return text;

    let working = text;
    for (const entry of entries) {
      if (this.isExplicitNone(entry)) continue;
      const match = this.parseAddEntry(entry);
      if (!match) {
        this.invalidateParsedArchitectDelta(parsed, `ADD entry has invalid syntax: "${entry}"`);
        continue;
      }
      const result = this.insertIntoCanonicalSection(working, match.sectionName, match.value);
      working = result.text;
      if (!result.applied) {
        parsed.warnings.push(`ADD target section missing: "${match.sectionName}"`);
      }
    }
    return working;
  }

  private parseLineEntries(block: string): string[] {
    if (!block) return [];
    return block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  }

  private validateAddBlock(parsed: ParsedArchitectDelta): void {
    for (const entry of this.parseLineEntries(parsed.addBlock)) {
      if (this.isExplicitNone(entry)) continue;
      if (!this.parseAddEntry(entry)) {
        this.invalidateParsedArchitectDelta(parsed, `ADD entry has invalid syntax: "${entry}"`);
      }
    }
  }

  private parseAddEntry(entry: string): { sectionName: string; value: string } | null {
    const match = entry.match(/^(OBJECTIVE|SCOPE|OUT OF SCOPE|MUST PRESERVE|KNOWN FACTS):\s*(.+)$/i);
    if (!match) return null;
    return {
      sectionName: match[1].toUpperCase(),
      value: match[2].trim(),
    };
  }

  private invalidateParsedArchitectDelta(parsed: ParsedArchitectDelta, reason: string): void {
    parsed.warnings.push(reason);
    parsed.invalidReasons.push(reason);
    parsed.valid = false;
  }

  private isExplicitNone(value: string): boolean {
    return value.trim().toUpperCase() === 'NONE';
  }

  private insertIntoCanonicalSection(text: string, sectionName: string, value: string): { text: string; applied: boolean } {
    const headingMap: Record<string, string> = {
      OBJECTIVE: 'Objective',
      SCOPE: 'Scope',
      'OUT OF SCOPE': 'Out of Scope',
      'MUST PRESERVE': 'Must Preserve',
      'KNOWN FACTS': 'Known Facts',
    };

    const heading = headingMap[sectionName];
    if (!heading) return { text, applied: false };

    const lines = text.split(/\r?\n/);
    const headingIdx = lines.findIndex(line => new RegExp(`^##\\s+${heading}\\s*$`, 'i').test(line.trim()));
    if (headingIdx === -1) return { text, applied: false };

    const nextHeadingRelative = lines.slice(headingIdx + 1).findIndex(line => /^##\s+/.test(line.trim()));
    const insertAt = nextHeadingRelative === -1 ? lines.length : headingIdx + 1 + nextHeadingRelative;

    const currentBody = lines.slice(headingIdx + 1, insertAt).join('\n').trim();
    const mergedBody = this.mergeCanonicalSectionBody(sectionName, currentBody, value);
    if (mergedBody === currentBody) {
      return { text, applied: true };
    }

    const rebuilt = [
      ...lines.slice(0, headingIdx + 1),
      ...(mergedBody ? mergedBody.split(/\r?\n/) : []),
      ...lines.slice(insertAt),
    ].join('\n');
    return { text: rebuilt, applied: true };
  }

  private mergeCanonicalSectionBody(sectionName: string, currentBody: string, incomingValue: string): string {
    if (sectionName === 'OBJECTIVE') {
      if (!currentBody) return incomingValue.trim();
      if (this.isNearDuplicate(currentBody, incomingValue)) return currentBody;
      return `${currentBody}\n\n${incomingValue.trim()}`;
    }

    // Preserve raw lines (with original bullet formatting) for output
    const existingRawLines = currentBody.split(/\r?\n/).map(l => l.trimEnd()).filter(Boolean);
    // Strip bullets only for comparison purposes
    const existingNormalized = existingRawLines.map(l =>
      this.normalizeComparableText(l.replace(/^[\s>*•\-\d.)]+/, ''))
    );

    const merged: string[] = [...existingRawLines];

    const incomingItems = this.splitComparableItems(incomingValue);  // stripped, for comparison
    const incomingRaw = incomingValue.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    for (let i = 0; i < incomingItems.length; i++) {
      const normalized = this.normalizeComparableText(incomingItems[i]);
      if (!normalized) continue;

      // Skip if exact match, substring overlap either direction, or near-duplicate
      const isDuplicate = existingNormalized.some(existing =>
        existing === normalized ||
        existing.includes(normalized) ||
        normalized.includes(existing) ||
        this.isNearDuplicate(existing, normalized)
      );
      if (isDuplicate) continue;

      // Add with bullet formatting — preserve if already present, otherwise prefix with -
      const raw = incomingRaw[i] || incomingItems[i];
      merged.push(/^[\-\*•]/.test(raw) ? raw : `- ${raw}`);
    }

    return merged.join('\n').trim();
  }

  private splitComparableItems(text: string): string[] {
    return text
      .split(/\r?\n/)
      .map(line => line.replace(/^[\s>*•\-\d.)]+/, '').trim())
      .filter(Boolean);
  }

  private normalizeComparableText(text: string): string {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private isNearDuplicate(existingText: string, incomingText: string): boolean {
    const existing = this.normalizeComparableText(existingText);
    const incoming = this.normalizeComparableText(incomingText);
    if (!existing || !incoming) return false;
    if (existing === incoming) return true;
    if (existing.includes(incoming) || incoming.includes(existing)) return true;

    const existingTokens = new Set(existing.split(' ').filter(Boolean));
    const incomingTokens = new Set(incoming.split(' ').filter(Boolean));
    let common = 0;
    for (const token of incomingTokens) {
      if (existingTokens.has(token)) common += 1;
    }
    const union = new Set([...existingTokens, ...incomingTokens]).size || 1;
    return common / union >= 0.8;
  }

  private buildTaskModeStepInstruction(step: PromptStep, hasPlannerOutput: boolean, taskMode: TaskMode): string {
    if (taskMode === 'implement') {
      return this.buildStepInstruction(step, hasPlannerOutput);
    }

    if (taskMode === 'audit') {
      return `# STEP: AUDIT

Work through each phase below in order. Check off every item before moving to the next phase. Do not make code changes.

## Phase 1: Inspect Scoped Files
- [ ] Read the task spec and the scoped files only
- [ ] Identify any missing facts, discrepancies, or unclear instructions
- [ ] Confirm the scope is read-only for this run

## Phase 2: Report Findings
- [ ] Inspect and analyze only; do not interpret this phase as authorization to edit code
- [ ] List findings, discrepancies, and risks with file-level references
- [ ] Call out any fixes that would be needed without applying them
- [ ] Keep the report limited to scoped files only

## Phase 3: File-Level Follow-Up Plan
- [ ] Provide the smallest follow-up plan for each needed fix
- [ ] Do not write or modify code in this run
- [ ] Do not rename files, symbols, or user-facing text

## Phase 4: Artifact Rules
- [ ] changed_files.json must be [] if no files were modified
- [ ] code_snippets.md may include existing code excerpts for review only
- [ ] Do not present newly authored code for this run

Output the audit result artifacts only. Do not modify source files.`;
    }

    return `# STEP: REGRESSION

Work through each phase below in order. Check off every item before moving to the next phase. Keep scope narrow.

## Phase 1: Confirm the Regression
- [ ] Read the task spec and scoped files only
- [ ] Identify the expected behavior versus the current behavior
- [ ] Pinpoint the most likely regression points

## Phase 2: Smallest Safe Fix Plan
- [ ] Propose the smallest fix path that addresses the regression
- [ ] Avoid widening scope, refactors, or unrelated cleanup
- [ ] Keep every change tied to a specific file and failure point

## Phase 3: Implement Narrowly
- [ ] Apply only the minimum fix needed for the regression
- [ ] Do not refactor unless explicitly requested
- [ ] Do not expand beyond scoped files

## Phase 4: Self-Review
- [ ] Verify the regression is addressed without side effects
- [ ] Confirm no out-of-scope file was modified
- [ ] Check for obvious type errors or broken imports

Output the regression result artifacts only. Do not widen scope.`;
  }

  private buildImplementStepInstruction(step: PromptStep, hasPlannerOutput: boolean): string {
    if (step === 'plan') {
      return this.buildStepInstruction(step, hasPlannerOutput);
    }
    return this.buildStepInstruction(step, hasPlannerOutput);
  }

  /**
   * Phased checklist instructions for each step.
   * Forces the AI coder through structured phases: read â†’ design/build â†’ review â†’ output.
   * The AI marks checkboxes as it completes each item — this constrains scope creep
   * and ensures self-review before writing artifacts.
   *
   * hasPlannerOutput: only reference the planner doc if it actually exists in this prompt.
   */
  private buildStepInstruction(step: PromptStep, hasPlannerOutput: boolean): string {
    if (step === 'plan') {
      return `# STEP: PLAN

Work through each phase below in order. Check off each item as you complete it. Do NOT write code.

## Phase 1: Read & Understand
- [ ] Read every file mentioned in the task scope
- [ ] Identify all files that consume or depend on what will change
- [ ] Flag any ambiguities or missing information in the task spec

## Phase 2: Design the Approach
- [ ] Write a 2–3 sentence strategy: what changes and why
- [ ] List every file that must change, with the reason for each
- [ ] Identify risks, regressions, and edge cases
- [ ] Note any unknowns that must be resolved before implementation

## Phase 3: Write planner_output.md
Produce this file with the following sections (omit any section that doesn't apply):
- [ ] **Approach** — 2–3 sentence strategy from Phase 2
- [ ] **Files to Change** — path + reason for each
- [ ] **Implementation Steps** — numbered, sequential; the implementer follows these exactly
- [ ] **Risks** — breakage, side effects, regressions
- [ ] **Unknowns** — anything requiring clarification before implementation

Output \`planner_output.md\` only. Do not modify source files. Do not write implementation code.`;
    }

    const plannerLine = hasPlannerOutput
      ? '\n- [ ] Read the planner_output.md above — your implementation steps are defined there'
      : '';

    return `# STEP: IMPLEMENT

Work through each phase below in order. Check off every item before moving to the next phase. Do not skip or combine phases.

## Phase 1: Build Your Task List
Before touching any files, output your specific checklist for THIS task:${plannerLine}
- [ ] List every discrete change you will make (one line per action, as checkboxes)
- [ ] For each must-preserve item, confirm it will not be broken by your changes — flag conflicts now

## Phase 2: Implement
Work through your Phase 1 task list item by item:
- [ ] Apply each change exactly as specified — no more, no less
- [ ] Do not touch any out-of-scope files
- [ ] Do not invent features or refactor beyond what the task requires

## Phase 3: Self-Review
- [ ] Re-read every Must Preserve item from the task spec — confirm each one still holds
- [ ] Verify no out-of-scope file was modified
- [ ] Check for obvious type errors or broken imports
- [ ] Rebuild the app after changes and check for obvious build errors

## Phase 4: Write Artifacts

TIMING: Do NOT create any of the 5 artifact files until Phase 3 self-review is fully complete.
Do NOT write placeholder or partial artifact files and then overwrite them.
The watcher imports the run the moment all 5 files appear — incomplete artifacts will be imported as-is.
Write each file exactly once, after all implementation is done.

TRUTHFULNESS:
- Only list a file in changed_files.json if you actually modified it in this run
- Only mark a check passed in review_checklist.json if you actively verified it
- Do not fabricate commit hashes, file paths, or validation results
- If implementation is incomplete, set status to "partial" and list unfinished work in risks
- Do not claim success if only planning or analysis occurred

TRACEABILITY:
- job_result.json must include a "planned_actions" array mapping your Phase 1 checklist
- Each entry: { "action": "<checklist text>", "status": "completed"|"skipped"|"failed", "reason": "<if not completed>" }
- Every file in changed_files.json must trace to at least one planned_action
- Any skipped/failed planned_action must appear in risks or remaining_gaps

Required files:
- [ ] job_result.json — task_id and run_id must match exactly as shown
- [ ] changed_files.json
- [ ] review_checklist.json
- [ ] job_summary.md
- [ ] code_snippets.md

Implement exactly as specified in the task above — whether that means code changes, new files, documentation, or configuration. Do not write code to satisfy an output requirement if the task only asks for a file or document.`;
  }

  /**
   * Strip accidental MAX/WeakSAUCE mode references from compiled prompt text.
   * Mode is a prompt-generator concept — the AI coder only needs to know the
   * declared CURRENT AGENT MODE (injected intentionally), not prose descriptions.
   *
   * Uses a guard pass to protect the explicit CURRENT AGENT MODE declaration
   * from being clobbered by the broad regex patterns.
   */
  private stripModeReferences(text: string): string {
    // Step 0: guard critical invariant strings so strip regexes can never destroy them
    const INVARIANTS = [
      'job_result.json',
      'changed_files.json',
      'review_checklist.json',
      'job_summary.md',
      'code_snippets.md',
      '"task_id"',
      '"run_id"',
    ];
    const invTokens: string[] = [];
    let working = text;
    for (const inv of INVARIANTS) {
      const escaped = inv.replace(/[.*+?^${}()|[\]\\\\]/g, '\\$&');
      working = working.replace(new RegExp(escaped, 'g'), (match) => {
        const idx = invTokens.length;
        invTokens.push(match);
        return `\x00INV_${idx}\x00`;
      });
    }

    // Step 1: protect intentional mode references from being clobbered by strip regexes
    // This includes: mode definition lines (- **MAX** —) and agent mode declarations
    const preserved: string[] = [];
    const guarded = working.replace(
      /^[^\n]*(?:\*{2}(?:MAX|WeakSAUCE)\*{2}|CURRENT AGENT MODE)[^\n]*/gm,
      (match) => {
        preserved.push(match);
        return `\x00PRESERVE_${preserved.length - 1}\x00`;
      }
    );

    // Step 2: strip all other accidental mode references that leak in from user system files
    let stripped = guarded
      .replace(/\b(?:in\s+)?(MAX|WeakSAUCE)\s+mode\b/gi, '')
      .replace(/\b(CURRENT\s+)?MODE:\s*(MAX|WeakSAUCE)\b/gi, '')
      .replace(/\*{0,2}CURRENT MODE\*{0,2}:\s*(MAX|WeakSAUCE)[^\n]*/gi, '')
      .replace(/\*{0,2}Mode\*{0,2}:\s*(MAX|WeakSAUCE)[^\n]*/gi, '')
      .replace(/\bMAX\s*\/\s*WeakSAUCE\b/gi, '')
      .replace(/\bWeakSAUCE\s*\/\s*MAX\b/gi, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[ \t]+\n/g, '\n');

    // Step 3: restore mode protections
    preserved.forEach((line, i) => {
      stripped = stripped.replace(`\x00PRESERVE_${i}\x00`, line);
    });

    // Step 4: restore invariant tokens and verify they survived
    invTokens.forEach((inv, i) => {
      stripped = stripped.replace(`\x00INV_${i}\x00`, inv);
    });
    for (const inv of INVARIANTS) {
      if (!stripped.includes(inv)) {
        throw new Error(`Compile invariant violated: "${inv}" was stripped from prompt`);
      }
    }

    return stripped;
  }

  private taskSpecToMarkdown(task: Task): string {
    // Omit any fields that are empty — no filler lines in the prompt
    const lines: string[] = ['# TASK SPECIFICATION'];
    if (task.title) lines.push(`**Title:** ${task.title}`);
    if (task.size) lines.push(`**Size:** ${task.size}`);
    if (task.description) lines.push(`\n## Objective\n${task.description}`);
    if (task.scope) lines.push(`\n## Scope\n${task.scope}`);
    if (task.outOfScope) lines.push(`\n## Out of Scope\n${task.outOfScope}`);
    const preserves = (task.mustPreserve || []).filter(Boolean);
    if (preserves.length) lines.push(`\n## Must Preserve\n${preserves.map(i => `- ${i}`).join('\n')}`);
    return lines.join('\n');
  }
}
