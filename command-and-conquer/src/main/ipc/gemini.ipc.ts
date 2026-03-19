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

  /**
   * Resolve the active Gemini API key and hot-reload model settings so changes
   * made in the Settings UI take effect on the next call without restarting.
   */
  async function resolveKey(providedKey?: string): Promise<string> {
    try {
      const settings = await fileStore.readJSON<{
        openaiApiKey?: string;
        flashModel?: string;
        proModel?: string;
        geminiApiKey?: string;
        geminiEnabled?: boolean;
      }>('system/settings.json');
      geminiService.updateSettings(settings);
      return (providedKey?.trim() || settings.openaiApiKey?.trim() || '').trim();
    } catch {
      return providedKey?.trim() || '';
    }
  }

  // ── Test API key ── Flash (just a ping) ─────────────────────────────────
  ipcMain.handle('gemini:test-key', async (_event, apiKey: string) => {
    try {
      const key = await resolveKey(apiKey);
      await geminiService.generate('Reply with the single word: OK', key, 'flash');
      return { error: false, data: { ok: true } };
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // ── Bootstrap knowledge ── Pro (complex synthesis from codebase) ──────────
  ipcMain.handle(
    'knowledge:bootstrap',
    async (_event, projectId: string, sourcePath: string, apiKey: string) => {
      try {
        const key = await resolveKey(apiKey);
        const result = await bootstrapKnowledgeService.bootstrap(projectId, sourcePath, key);
        return { error: false, data: result };
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ── Send prompt to AI API ── Pro (actual coding work, needs reasoning) ────
  ipcMain.handle(
    'prompts:send-to-flash',
    async (
      _event,
      projectId: string,
      taskId: string,
      step: string,
      apiKey: string
    ) => {
      try {
        const key = await resolveKey(apiKey);
        const promptStep: PromptStep = step === 'implement' ? 'implement' : 'plan';

        const compiled = await promptCompilerService.compile(
          projectId, taskId, promptStep, 'MAX'
        ) as any;
        const runId = compiled.pendingRunId;
        const outputPath = `workspace/projects/${projectId}/runs/${runId}`;

        const fullPrompt = compiled.compiledText + '\n\n' + buildApiModeSuffix();

        // Pro model — higher token ceiling for complex coding responses
        const response = await geminiService.generate(fullPrompt, key, 'pro', 8192);

        const parsedFiles = GeminiService.parseFileBlocks(response);

        // ── Normalize artifacts ───────────────────────────────────────────

        if (parsedFiles['job_result.json']) {
          try {
            const jr = JSON.parse(parsedFiles['job_result.json']) as Record<string, unknown>;
            jr['task_id'] = taskId;
            jr['run_id'] = jr['run_id'] || runId;
            const statusMap: Record<string, string> = {
              complete: 'success', done: 'success', completed: 'success',
              success: 'success', partial: 'partial', failed: 'failed', error: 'failed',
            };
            jr['status'] = statusMap[String(jr['status']).toLowerCase()] ?? 'success';
            if (!Array.isArray(jr['risks'])) jr['risks'] = [];
            if (!Array.isArray(jr['manual_validation'])) {
              jr['manual_validation'] = [];
            } else {
              jr['manual_validation'] = (jr['manual_validation'] as Record<string, unknown>[]).map(v => ({
                ...v, result: String(v['result'] ?? 'skipped').toLowerCase(),
              }));
            }
            if (!jr['commit_hash']) jr['commit_hash'] = null;
            parsedFiles['job_result.json'] = JSON.stringify(jr, null, 2);
          } catch { /* keep original */ }
        }

        if (parsedFiles['review_checklist.json']) {
          try {
            const rc = JSON.parse(parsedFiles['review_checklist.json']) as Record<string, unknown>;
            if (!Array.isArray(rc['checks_run'])) {
              const raw = (rc['items'] || rc['checks'] || []) as Record<string, unknown>[];
              rc['checks_run'] = raw.map(item => ({
                category: String(item['category'] || 'functionality'),
                check: String(item['check'] || item['description'] || 'Verify output'),
                priority: String(item['priority'] || 'must'),
                result: String(item['result'] ?? 'passed').toLowerCase(),
              }));
            }
            if (!Array.isArray(rc['checks_skipped'])) rc['checks_skipped'] = [];
            if (!Array.isArray(rc['unresolved_items'])) rc['unresolved_items'] = [];
            parsedFiles['review_checklist.json'] = JSON.stringify({
              checks_run: rc['checks_run'],
              checks_skipped: rc['checks_skipped'],
              unresolved_items: rc['unresolved_items'],
            }, null, 2);
          } catch { /* keep original */ }
        }

        if (parsedFiles['changed_files.json']) {
          try {
            const cf = JSON.parse(parsedFiles['changed_files.json']);
            const arr = Array.isArray(cf) ? cf : (cf['files'] || cf['changed_files'] || []);
            parsedFiles['changed_files.json'] = JSON.stringify(
              (arr as Record<string, unknown>[]).map(f => ({
                path: String(f['path'] || f['file'] || ''),
                change_type: String(f['change_type'] || f['changeType'] || f['type'] || 'modified'),
                purpose: String(f['purpose'] || f['description'] || ''),
                risk_level: String(f['risk_level'] || f['riskLevel'] || f['risk'] || 'low'),
              })), null, 2
            );
          } catch { /* keep original */ }
        }

        // ── Write files to disk ─────────────────────────────────────────
        const filesWritten: string[] = [];

        for (const [filename, content] of Object.entries(parsedFiles)) {
          try {
            if (filename.startsWith('knowledge_updates/')) {
              const kf = filename.substring('knowledge_updates/'.length);
              const kPath = `workspace/projects/${projectId}/runs/${runId}/knowledge_updates/${kf}`;
              if (kf.endsWith('.md')) await fileStore.writeMarkdown(kPath, content);
              else if (kf.endsWith('.json')) await fileStore.writeJSON(kPath, JSON.parse(content));
            } else {
              const filePath = `${outputPath}/${filename}`;
              if (filename.endsWith('.md')) await fileStore.writeMarkdown(filePath, content);
              else if (filename.endsWith('.json')) await fileStore.writeJSON(filePath, JSON.parse(content));
              else await fileStore.writeMarkdown(filePath, content);
            }
            filesWritten.push(filename);
          } catch (error) {
            console.error(`Failed to write ${filename}:`, error);
          }
        }

        return { error: false, data: { runId, filesWritten } };
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ── Tighten a prompt ── Flash (gpt-4o-mini optimizer for task-specific sections) ─
  ipcMain.handle('prompts:tighten', async (_event, promptText: string, apiKey: string) => {
    try {
      const key = await resolveKey(apiKey);
      const result = await promptRefinerService.refine(promptText, key);
      return { error: false, data: result };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ── Fuse manual tighten result ── takes pasted LLM output, merges back with statics ──
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

  // ── Improve task description ── Flash (cheap, structured rewrite) ──────────
  // Takes a rough title + description and returns an improved spec: description,
  // scope, outOfScope, mustPreserve[]. Displayed inline in PromptBuilder for tweaking.
  ipcMain.handle('tasks:improve-description', async (
    _event,
    title: string,
    description: string,
    apiKey: string
  ) => {
    try {
      const key = await resolveKey(apiKey);
      const hasDescription = description && description.trim().length > 0;
      const systemPrompt = `You are a senior software engineer writing an engineering task spec. Output ONLY valid JSON — no markdown fences, no preamble. The JSON must match exactly:
{
  "description": "2-3 sentence objective — what and why",
  "scope": "exactly what files/components/layers will change",
  "outOfScope": "what must NOT be touched or changed",
  "mustPreserve": ["existing behavior or contract 1", "existing behavior or contract 2"]
}
Rules:
- ${hasDescription ? 'The description field is provided by the user — PRESERVE their intent and wording, only clarify or tighten it. Do not replace it with a generic rewrite.' : 'Write a clear 2-3 sentence objective based on the title.'}
- Be specific about file paths and component names if inferable from the title/description.
- Scope must be tight and actionable — list the actual files/components/layers that change.
- outOfScope: name things that are adjacent but must not be touched.
- mustPreserve: list existing behaviors or contracts that must not break.
- If info is insufficient, make reasonable assumptions for a TypeScript/Electron/React codebase.`;

      const userMsg = `Title: ${title}\n${hasDescription ? `Description: ${description}` : ''}`;
      const raw = await geminiService.generate(`${systemPrompt}\n\n${userMsg}`, key, 'flash');

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

  // ── Generate repo context ── Flash (file scan + synthesis, cheap) ──────────
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

  // ── Evaluate a run ── Flash (structured scoring, formulaic) ──────────────
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
