import { ipcMain } from 'electron';
import { GeminiService } from '../services/gemini.service';
import { BootstrapKnowledgeService } from '../services/bootstrap-knowledge.service';
import { PromptCompilerService } from '../services/prompt-compiler.service';
import { PromptRefinerService } from '../services/prompt-refiner.service';
import { PromptFuserService } from '../services/prompt-fuser.service';
import { RepoContextService } from '../services/repo-context.service';
import { RunEvaluatorService } from '../services/run-evaluator.service';
import { FileStore } from '../storage/file-store';
import { PromptStep } from '../types';

export function registerGeminiHandlers(
  geminiService: GeminiService,
  bootstrapKnowledgeService: BootstrapKnowledgeService,
  promptCompilerService: PromptCompilerService,
  fileStore: FileStore,
  promptRefinerService: PromptRefinerService,
  promptFuserService: PromptFuserService,
  repoContextService: RepoContextService,
  runEvaluatorService: RunEvaluatorService
): void {

  interface OpenAISettings {
    openaiApiKey?: string;
    flashModel?: string;
    proModel?: string;
    taskOptimizerModel?: string;
    bootstrapModel?: string;
    revisionModel?: string;
    geminiApiKey?: string;
    geminiEnabled?: boolean;
    geminiFlashModel?: string;
    geminiProModel?: string;
  }

  /**
   * Resolve the active Gemini API key and hot-reload model settings so changes
   * made in the Settings UI take effect on the next call without restarting.
   */
  async function resolveSettings(providedKey?: string): Promise<{ key: string; settings: OpenAISettings }> {
    try {
      const settings = await fileStore.readJSON<OpenAISettings>('system/settings.json');
      geminiService.updateSettings(settings);
      return {
        key: (providedKey?.trim() || settings.openaiApiKey?.trim() || '').trim(),
        settings,
      };
    } catch {
      return {
        key: providedKey?.trim() || '',
        settings: {},
      };
    }
  }

  async function resolveKey(providedKey?: string): Promise<string> {
    const resolved = await resolveSettings(providedKey);
    return resolved.key;
  }

  // Fuse manual tighten result - takes pasted LLM output, merges back with statics.
  ipcMain.handle('prompts:fuse-analysis', async (
    _event,
    originalPrompt: string,
    llmOutput: string,
    apiKey: string
  ) => {
    try {
      const key = await resolveKey(apiKey);
      const result = await promptFuserService.fuse(originalPrompt, llmOutput, key);
      return { error: false, data: result };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Improve task description - Flash (cheap, structured rewrite).
  // Takes a rough title + description and returns an improved spec: description,
  // scope, outOfScope, mustPreserve[]. Displayed inline in PromptBuilder for tweaking.
  ipcMain.handle('tasks:improve-description', async (
    _event,
    title: string,
    description: string,
    apiKey: string
  ) => {
    try {
      const { key, settings } = await resolveSettings(apiKey);
      const modelOverride = settings.taskOptimizerModel || settings.flashModel || 'gpt-4o-mini';
      const hasDescription = description && description.trim().length > 0;
      const systemPrompt = `You are a senior software engineer writing an engineering task spec. Output ONLY valid JSON - no markdown fences, no preamble. The JSON must match exactly:
{
  "description": "2-3 sentence objective - what and why",
  "scope": "exactly what files/components/layers will change",
  "outOfScope": "what must NOT be touched or changed",
  "mustPreserve": ["existing behavior or contract 1", "existing behavior or contract 2"]
}
Rules:
- ${hasDescription ? 'The description field is provided by the user - PRESERVE their intent and wording, only clarify or tighten it. Do not replace it with a generic rewrite.' : 'Write a clear 2-3 sentence objective based on the title.'}
- Be specific about file paths and component names if inferable from the title/description.
- Scope must be tight and actionable - list the actual files/components/layers that change.
- outOfScope: name things that are adjacent but must not be touched.
- mustPreserve: list existing behaviors or contracts that must not break.
- If info is insufficient, make reasonable assumptions for a TypeScript/Electron/React codebase.`;

      const userMsg = `Title: ${title}\n${hasDescription ? `Description: ${description}` : ''}`;
      const raw = await geminiService.generate(`${systemPrompt}\n\n${userMsg}`, key, 'flash', undefined, undefined, modelOverride);

      // Strip any accidental markdown fences the model might add
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned) as {
        description: string;
        scope: string;
        outOfScope: string;
        mustPreserve: string[];
      };
      return { error: false, data: parsed };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Generate repo context - Flash (file scan + synthesis, cheap).
  ipcMain.handle('repos:generate-context', async (
    _event,
    projectId: string,
    repoPath: string,
    apiKey: string
  ) => {
    try {
      const key = await resolveKey(apiKey);
      const result = await repoContextService.generateContext(projectId, repoPath, key);
      return { error: false, data: result };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Evaluate a run - Flash (structured scoring, formulaic).
  // Evaluate a run - Flash (structured scoring, formulaic). ── Flash (structured scoring, formulaic) ──────────────
  ipcMain.handle(
    'runs:evaluate',
    async (
      _event,
      taskSpec: { title: string; scope: string },
      artifacts: { jobSummary: string; changedFiles: string[]; risks: string[] },
      apiKey: string
    ) => {
      try {
        const key = await resolveKey(apiKey);
        const result = await runEvaluatorService.evaluate(taskSpec, artifacts, key);
        return { error: false, data: result };
      } catch (error) {
        return { error: true, message: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  );
}

function buildApiModeSuffix(): string {
  return `---

## API RESPONSE MODE

You CANNOT write files to disk. Output every artifact inline:

===FILE: filename===
content
===ENDFILE===

Output ALL 5 files in order:

===FILE: job_result.json===
{"task_id":"<copy from Task field>","run_id":"<copy from Run ID field>","tool":"gemini","model":"gemini-1.5-pro","status":"success","summary":"<what was done>","risks":[],"manual_validation":[],"commit_hash":null,"created_at":"<ISO timestamp>"}
===ENDFILE===

===FILE: changed_files.json===
[{"path":"<file>","change_type":"modified","purpose":"<why>","risk_level":"low"}]
===ENDFILE===

===FILE: review_checklist.json===
{"checks_run":[{"category":"functionality","check":"<what to verify>","priority":"must","result":"passed"}],"checks_skipped":[],"unresolved_items":[]}
===ENDFILE===

===FILE: job_summary.md===
# Job Summary
<What was done, key decisions, anything unfinished>
===ENDFILE===

===FILE: code_snippets.md===
# Key Code Changes
<Most important new/changed code with context>
===ENDFILE===

Valid JSON only in .json blocks. task_id must match exactly. End with DONE on its own line.`;
}

