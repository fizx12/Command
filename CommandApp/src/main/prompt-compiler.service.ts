import { FileStore } from '../storage/file-store';
import { PromptStack, CompiledPrompt, AgentMode } from '../types';
import * as crypto from 'crypto';

export class PromptCompilerService {
  private fileStore: FileStore;

  constructor(fileStore: FileStore) {
    this.fileStore = fileStore;
  }

  async compile(projectId: string, taskId: string, agentId: string, mode: AgentMode): Promise<CompiledPrompt> {
    let globalRules = '';
    let masterPrompt = '';
    let projectPrimer = '';
    let sourceOfTruth = '';
    let taskSpecStr = '';
    let plannerOutput = '';
    let carryForward = '';
    let agentDef = '';
    let outputFormat = '';
    let artifactTail = '';

    try {
      globalRules = await this.fileStore.readMarkdown('system/GLOBAL_RULES.md');
    } catch { /* Ignore missing */ }

    try {
      masterPrompt = await this.fileStore.readMarkdown('system/MASTER_PROMPT.md');
    } catch { /* Ignore missing */ }

    try {
      projectPrimer = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/knowledge/docs/APP_PRIMER.md`);
    } catch { /* Ignore missing */ }

    try {
      sourceOfTruth = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/knowledge/docs/SOURCE_OF_TRUTH_INDEX.md`);
    } catch { /* Ignore missing */ }

    try {
      const taskSpec = await this.fileStore.readJson<any>(`workspace/projects/${projectId}/tasks/${taskId}/task_spec.json`);
      if (taskSpec) {
        taskSpecStr = this.taskSpecToMarkdown(taskSpec);
      }
    } catch { /* Ignore missing */ }

    try {
      plannerOutput = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/tasks/${taskId}/planner_output.md`);
    } catch { /* Ignore missing */ }

    try {
      carryForward = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/tasks/${taskId}/carry_forward.md`);
    } catch { /* Ignore missing */ }

    try {
      agentDef = await this.fileStore.readMarkdown(`workspace/projects/${projectId}/agents/${agentId}.md`);
    } catch {
      try {
        agentDef = await this.fileStore.readMarkdown('system/AGENT_LIBRARY.md');
      } catch { /* Ignore missing */ }
    }

    try {
      outputFormat = await this.fileStore.readMarkdown('system/OUTPUT_FORMAT.md');
    } catch { /* Ignore missing */ }

    try {
      artifactTail = await this.fileStore.readMarkdown('system/ARTIFACT_TAIL.md');
    } catch { /* Ignore missing */ }

    const sections: string[] = [];

    if (mode === 'WeakSAUCE') {
      if (taskSpecStr) sections.push(taskSpecStr);
      if (agentDef) sections.push(agentDef);
      if (outputFormat) sections.push(outputFormat);
      if (artifactTail) sections.push(artifactTail);
    } else {
      if (globalRules) sections.push(globalRules);
      if (masterPrompt) sections.push(masterPrompt);
      if (projectPrimer) sections.push(projectPrimer);
      if (sourceOfTruth) sections.push(sourceOfTruth);
      if (taskSpecStr) sections.push(taskSpecStr);
      if (plannerOutput) sections.push(plannerOutput);
      if (carryForward) sections.push(carryForward);
      if (agentDef) sections.push(agentDef);
      if (outputFormat) sections.push(outputFormat);
      if (artifactTail) sections.push(artifactTail);
    }

    const compiledText = sections.join('\n\n---\n\n');
    const estimatedTokens = Math.ceil(compiledText.length / 4);

    return {
      template: compiledText,
      mode,
      estimatedTokens
    };
  }

  async preview(projectId: string, taskId: string, agentId: string, mode: AgentMode): Promise<string> {
    const compiled = await this.compile(projectId, taskId, agentId, mode);
    return compiled.template;
  }

  private taskSpecToMarkdown(task: any): string {
    return `# TASK SPECIFICATION
**Title:** ${task.title || ''}
**Size:** ${task.size || ''}
**Scope:** ${task.scope || ''}
**Out of Scope:** ${task.outOfScope || ''}

## Must Preserve
${(task.mustPreserve || []).map((i: string) => `- ${i}`).join('\n')}

## Description
${task.description || ''}
`;
  }
}
