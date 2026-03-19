import { FileStore } from '../storage/file-store';
import { TaskService } from './task.service';
import { PromptStack, CompiledPrompt, AgentMode, PromptStep, Task, Run, RunStatus, RunTimelineEntry } from '../types';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export class PromptCompilerService {
  private static readonly CHIEF_ARCHITECT_STRING = `# SYSTEM DIRECTIVE: CHIEF ARCHITECT
You are the Chief Software Architect for the Command & Conquer orchestration system.

Two modes:
- **MAX** - Full context stack. You have global rules, project primer, source of truth, task spec, planner output, and carry-forward history. Use all of it.
- **WeakSAUCE** - Task spec + agent role + output format only. For isolated, low-risk changes where extra context would hurt more than help.

Your job is to take a raw feature request and turn it into a stripped, literal implementation plan for a junior coding agent. Do not repeat boilerplate the executor already knows.

### THE RULES OF ARCHITECTURE:
1. **Zero Ambiguity:** Never say "update the UI." Say exactly which component, handler, or file changes.
2. **State the Obvious:** Explicitly list imports, interface updates, and IPC channel names when relevant.
3. **Strict Guardrails:** Define exactly what the agent must *not* touch to prevent collateral damage.
4. **Chronological Phasing:** Build the foundation (types/state) before the logic (services/IPC), and the logic before the presentation (UI).

---

### OUTPUT FORMAT
Output ONLY the following two sections in this exact order. No preamble, no commentary, nothing else.

1. Reproduce the # TASK SPECIFICATION section from the context above — **verbatim, unchanged**. Do not rewrite, summarize, or add to it.

2. Then output the planner phases:

# PLANNER OUTPUT

**Phase 1: Types & State (The Foundation)**
* [ ] ...
**Phase 2: Backend & Services (The Logic)**
* [ ] ...
**Phase 3: Frontend & UI (The Presentation)**
* [ ] ...
**Phase 4: Final Verification**
* [ ] ...`;

  private fileStore: FileStore;
  private taskService?: TaskService;

  constructor(fileStore: FileStore, taskService?: TaskService) {
    this.fileStore = fileStore;
    this.taskService = taskService;
  }

  private async getRunsBasePath(projectId: string): Promise<string> {
    try {
      const settings = await this.fileStore.readJSON<{ hubPath?: string }>('system/settings.json');
      if (settings?.hubPath?.trim()) {
        return path.join(settings.hubPath.trim(), 'runs', projectId);
      }
    } catch { /* fall back to workspace */ }
    return this.fileStore.resolvePath(`workspace/projects/${projectId}/runs`);
  }

  async compile(projectId: string, taskId: string, step: PromptStep, mode: AgentMode): Promise<CompiledPrompt> {
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

    try { globalRules   = await this.fileStore.readMarkdown('system/GLOBAL_RULES.md'); }   catch { /* missing */ }
    try { masterPrompt  = await this.fileStore.readMarkdown('system/MASTER_PROMPT.md'); }  catch { /* missing */ }
    try { projectPrimer = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/knowledge/docs/APP_PRIMER.md`); } catch { /* missing */ }
    try { sourceOfTruth = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/knowledge/docs/SOURCE_OF_TRUTH_INDEX.md`); } catch { /* missing */ }
    try { repoContext   = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/knowledge/docs/REPO_CONTEXT.md`); } catch { /* missing — only present after Generate Context */ }

    try {
      taskSpec = await this.fileStore.readJSON<Task>(`workspace/projects/${projectId}/tasks/${taskId}/task_spec.json`);
      if (taskSpec) taskSpecStr = this.taskSpecToMarkdown(taskSpec);
    } catch { /* missing */ }

    try { plannerOutput = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/tasks/${taskId}/planner_output.md`); } catch { /* missing */ }
    try { carryForward  = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/tasks/${taskId}/carry_forward.md`); }  catch { /* missing */ }

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

    // â”€â”€ TASK SPEC ALWAYS FIRST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Put the "what" before the "how". The coder sees the objective immediately.
    // Empty sections are intentionally omitted — no filler content.
    if (taskSpecStr)          sections.push(taskSpecStr);
    // plannerOutput only flows into implement step (plan step produces it)
    if (step === 'implement' && plannerOutput) sections.push(plannerOutput);
    if (carryForward)         sections.push(carryForward);

    if (mode === 'WeakSAUCE') {
      // Thin stack — task + directive only, no global context
      if (masterPrompt)       sections.push(masterPrompt + `\n\n**CURRENT AGENT MODE:** ${mode}`);
      if (outputFormat)       sections.push(outputFormat);
    } else {
      // MAX stack — full context follows the task spec
      if (globalRules)        sections.push(globalRules);
      // Append the live mode so the agent knows exactly which behavioral ruleset applies.
      // This line is protected from stripModeReferences() via the PRESERVE guard.
      if (masterPrompt)       sections.push(masterPrompt + `\n\n**CURRENT AGENT MODE:** ${mode}`);
      if (projectPrimer)      sections.push(projectPrimer);
      if (sourceOfTruth)      sections.push(sourceOfTruth);
      if (repoContext)        sections.push(repoContext);
      if (outputFormat)       sections.push(outputFormat);
    }

    // â”€â”€ STEP INSTRUCTION ALWAYS LAST (before output location) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Phased checklist: forces the AI to plan â†’ implement â†’ self-review â†’ artifacts.
    // hasPlannerOutput controls whether the "follow the plan" reference appears.
    const hasPlannerOutput = !!(step === 'implement' && plannerOutput);
    const stepInstruction = this.buildStepInstruction(step, hasPlannerOutput);
    sections.push(stepInstruction);

    // Output location always goes last
    sections.push(outputLocationBlock);

    // Join and strip any MAX/WeakSAUCE mode references that leak in from system files.
    // Mode only controls what the prompt compiler includes — the AI coder never needs to know about it.
    const rawText = sections.join('\n\n---\n\n');
    const compiledText = this.stripModeReferences(rawText);
    const tokenEstimate = Math.ceil(compiledText.length / 4);

    // Save the compiled prompt to disk so it can be viewed alongside the run later
    const promptPath = `workspace/projects/${projectId}/tasks/${taskId}/prompts/PROMPT-${runId}.md`;
    try {
      await this.fileStore.writeMarkdown(promptPath, compiledText);
    } catch { /* non-fatal — prompt history is best-effort */ }

    const runsBasePath = await this.getRunsBasePath(projectId);
    const now = new Date().toISOString();
    const placeholderTimeline: RunTimelineEntry[] = [{
      id: 'timeline-' + crypto.randomUUID().slice(0, 8),
      timestamp: now,
      type: 'prompt_compiled',
      title: 'Prompt Compiled',
      content: `Prompt saved at ${promptPath}`,
      metadata: {
        step,
        mode,
        promptPath,
      },
    }];

    const placeholderRun: Run = {
      id: runId,
      projectId,
      taskId,
      activeRepoId: taskSpec?.activeRepoId || 'UNKNOWN',
      agentId: step, // step replaces agentId — stored as run identity marker
      tool: 'command-and-conquer',
      model: step,
      mode,
      promptPath,
      artifactPaths: [],
      status: 'importing' as RunStatus,
      summary: 'Prompt compiled; awaiting AI run import.',
      risks: [],
      validation: [],
      changedFiles: [],
      commitHash: null,
      timeline: placeholderTimeline,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const placeholderMetaPath = path.join(runsBasePath, runId, 'run.meta.json');
      await fs.mkdir(path.dirname(placeholderMetaPath), { recursive: true });
      await fs.writeFile(placeholderMetaPath, JSON.stringify(placeholderRun, null, 2), 'utf8');
    } catch { /* non-fatal — placeholder run is best-effort */ }

    if (this.taskService) {
      try {
        await this.taskService.linkRunToTask(projectId, taskId, runId);
      } catch { /* non-fatal */ }
    }

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

  async preview(projectId: string, taskId: string, step: PromptStep, mode: AgentMode): Promise<string> {
    const compiled = await this.compile(projectId, taskId, step, mode);
    return compiled.compiledText;
  }

  /**
   * Builds the Chief Architect payload: task spec + codebase context docs + architect persona.
   * This gets pasted into a smart LLM (GPT-5.4) to produce a precise implementation plan.
   */
  async buildArchitectPayload(projectId: string, taskId: string): Promise<string> {
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
    if (taskSpecStr)   sections.push(taskSpecStr);
    if (projectPrimer) sections.push(projectPrimer);
    if (sourceOfTruth) sections.push(sourceOfTruth);

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
    // Strip any template echo or preamble GPT-5.4 might have included.
    // Only keep content from # TASK SPECIFICATION onward — that's the architect's actual plan.
    const taskSpecMarker = architectOutput.indexOf('# TASK SPECIFICATION');
    const cleanedArchitectOutput = taskSpecMarker !== -1
      ? architectOutput.slice(taskSpecMarker).trim()
      : architectOutput.trim();

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

    let globalRules = '';
    let masterPrompt = '';
    let outputFormat = '';

    try { globalRules  = await this.fileStore.readMarkdown('system/GLOBAL_RULES.md'); }  catch { /* missing */ }
    try { masterPrompt = await this.fileStore.readMarkdown('system/MASTER_PROMPT.md'); } catch { /* missing */ }
    try { outputFormat = await this.fileStore.readMarkdown('system/OUTPUT_FORMAT.md'); } catch { /* missing */ }

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
    sections.push(cleanedArchitectOutput);

    if (globalRules)  sections.push(globalRules);
    if (masterPrompt)  sections.push(masterPrompt + `\n\n**CURRENT AGENT MODE:** MAX`);
    if (outputFormat)  sections.push(outputFormat);

    const stepInstruction = this.buildStepInstruction('implement', true);
    sections.push(stepInstruction);
    sections.push(outputLocationBlock);

    const rawText = sections.join('\n\n---\n\n');
    const compiledText = this.stripModeReferences(rawText);
    const tokenEstimate = Math.ceil(compiledText.length / 4);

    const promptPath = `workspace/projects/${projectId}/tasks/${taskId}/prompts/PROMPT-${runId}.md`;
    try {
      await this.fileStore.writeMarkdown(promptPath, compiledText);
    } catch { /* non-fatal */ }

    const runsBasePath = await this.getRunsBasePath(projectId);
    const now = new Date().toISOString();
    const placeholderTimeline: RunTimelineEntry[] = [{
      id: 'timeline-' + crypto.randomUUID().slice(0, 8),
      timestamp: now,
      type: 'prompt_compiled',
      title: 'Prompt Compiled',
      content: `Prompt saved at ${promptPath}`,
      metadata: {
        step: 'implement',
        mode: 'MAX',
        promptPath,
      },
    }];

    const placeholderRun: Run = {
      id: runId,
      projectId,
      taskId,
      activeRepoId: 'UNKNOWN',
      agentId: 'implement',
      tool: 'command-and-conquer',
      model: 'implement',
      mode: 'MAX',
      promptPath,
      artifactPaths: [],
      status: 'importing' as RunStatus,
      summary: 'Architect prompt compiled; awaiting AI run import.',
      risks: [],
      validation: [],
      changedFiles: [],
      commitHash: null,
      timeline: placeholderTimeline,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const placeholderMetaPath = path.join(runsBasePath, runId, 'run.meta.json');
      await fs.mkdir(path.dirname(placeholderMetaPath), { recursive: true });
      await fs.writeFile(placeholderMetaPath, JSON.stringify(placeholderRun, null, 2), 'utf8');
    } catch { /* non-fatal */ }

    if (this.taskService) {
      try {
        await this.taskService.linkRunToTask(projectId, taskId, runId);
      } catch { /* non-fatal */ }
    }

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
    } as CompiledPrompt & { pendingRunId: string; promptPath: string };
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

## Phase 4: Write Artifacts
Write all 5 files to the exact output path in the OUTPUT LOCATION section:
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
    // Step 1: protect intentional mode references from being clobbered by strip regexes
    // This includes: mode definition lines (- **MAX** —) and agent mode declarations
    const preserved: string[] = [];
    const guarded = text.replace(
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

    // Step 3: restore the protected CURRENT AGENT MODE declarations
    preserved.forEach((line, i) => {
      stripped = stripped.replace(`\x00PRESERVE_${i}\x00`, line);
    });

    return stripped;
  }

  private taskSpecToMarkdown(task: Task): string {
    // Omit any fields that are empty — no filler lines in the prompt
    const lines: string[] = ['# TASK SPECIFICATION'];
    if (task.title)       lines.push(`**Title:** ${task.title}`);
    if (task.size)        lines.push(`**Size:** ${task.size}`);
    if (task.description) lines.push(`\n## Objective\n${task.description}`);
    if (task.scope)       lines.push(`\n## Scope\n${task.scope}`);
    if (task.outOfScope)  lines.push(`\n## Out of Scope\n${task.outOfScope}`);
    const preserves = (task.mustPreserve || []).filter(Boolean);
    if (preserves.length) lines.push(`\n## Must Preserve\n${preserves.map(i => `- ${i}`).join('\n')}`);
    return lines.join('\n');
  }
}

