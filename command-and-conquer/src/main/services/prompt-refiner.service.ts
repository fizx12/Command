  import * as fs from 'fs/promises';
  import * as path from 'path';
  import { GeminiService, GenerateTraceOptions } from './gemini.service';
  import { extractRunFolderFromCompiledPrompt } from './optimizer-trace.utils';

  // Headers that identify static boilerplate sections (never tightened - they're shared across all tasks)
  const STATIC_HEADERS = [
    'GLOBAL RULES', 'COMMAND & CONQUER', 'OUTPUT FORMAT',
    'OUTPUT LOCATION', 'AGENT ROLE', 'AGENT DEFINITION',
  ];

  interface PromptSection {
    content: string;
    index: number;
    isStatic: boolean;
  }

  interface ParsedOptimizerOutput {
    level: 'FULL' | 'LIGHTWEIGHT' | 'SKELETON' | 'UNKNOWN';
    reason: string;
    enhancements: string;
    taskContent: string;
    warnings: string[];
  }

  export class PromptRefinerService {
    constructor(private geminiService: GeminiService) {}

    async refine(promptText: string, apiKey: string): Promise<{ refined: string; changeSummary: string }> {
      const sections = this.splitPrompt(promptText);
      const taskSections = sections.filter(s => !s.isStatic);

      if (taskSections.length === 0) {
        // Fallback: tighten whole prompt with flash
        return this.tightenWhole(promptText, apiKey, promptText);
      }

      const taskText = taskSections.map(s => s.content).join('\n\n---\n\n');
      const optimizerPrompt = this.buildOptimizerPrompt(taskText);
      const trace = this.buildTraceOptions(promptText, 'prompt_optimizer');

      const raw = await this.geminiService.generate(
        optimizerPrompt,
        apiKey,
        'flash',
        undefined,
        trace
      );

      const parsed = this.parseOptimizerOutput(raw);
      const rewrittenTaskText = parsed.taskContent.trim() || taskText;
      const merged = this.mergeBack(promptText, taskSections, rewrittenTaskText);

      const changeSummary = parsed.enhancements
        || (parsed.warnings.length > 0 ? 'Prompt optimized with fallback parsing' : 'Task-specific sections tightened with GPT-4o-mini');

      if (parsed.warnings.length > 0 && trace?.traceFilePath) {
        await this.appendParseNotes(trace.traceFilePath, parsed);
      }

      return { refined: merged, changeSummary };
    }

    private splitPrompt(text: string): PromptSection[] {
      const parts = text.split(/\n\n---\n\n/);
      return parts.map((part, index) => {
        const headerMatch = part.match(/^#+ (.+)/m);
        const header = headerMatch ? headerMatch[1].trim().toUpperCase() : '';
        const isStatic = STATIC_HEADERS.some(s => header.includes(s));
        return { content: part, index, isStatic };
      });
    }

    private buildOptimizerPrompt(taskText: string): string {
      return `You are a prompt engineering expert preparing a task for an AI coding agent.

  Analyze the TASK SPECIFICATION below. Your job:
  1. Improve the clarity and completeness of the task spec
  2. Choose the minimum context level the coder needs to succeed
  3. Output the improved spec — nothing else

  CONTEXT LEVELS:
  FULL — multi-file changes, side effects across modules, unfamiliar codebase area, or complex logic
  LIGHTWEIGHT — isolated change in known area, single file/component, clear requirements
  SKELETON — trivial change, rename, single-line fix, or config-only edit

  RULES:
  - Enhance & Clarify: Rewrite the task spec (Objective, Scope, Out of Scope, Must Preserve) to be professional, unambiguous, and highly actionable. Infer and add missing best practices (error handling, edge cases, strict typing) only if logically required but absent.
  - Pick the level that gives the coder JUST ENOUGH context — no more, no less.
  - Keep ALL: explicit file paths and Must Preserve constraints.
  - Remove: vague language, emotional venting, repeated explanations, generic tutorials.

  OUTPUT FORMAT — output in this EXACT order, no preamble, no other text:

  Enhancements: <one sentence summarizing what you added or clarified vs the raw spec>
  Reason: <evaluate the scope and codebase impact in one sentence>
  ===LEVEL: [FULL|LIGHTWEIGHT|SKELETON]===

  [improved and tightened task specification here — same section headers]

  ---TASK SPECIFICATION---
  ${taskText}`;
    }

    private buildTraceOptions(promptText: string, label: string): GenerateTraceOptions | undefined {
      const runFolder = extractRunFolderFromCompiledPrompt(promptText);
      if (!runFolder) return undefined;

      return {
        label,
        traceFilePath: path.join(runFolder, 'optimizer_trace.md'),
        metadata: {
          runFolder,
        },
      };
    }

    private parseOptimizerOutput(output: string): ParsedOptimizerOutput {
      const warnings: string[] = [];
      const trimmed = output.trim();

      const levelMatch = trimmed.match(/(?:===\s*)?LEVEL:\s*(FULL|LIGHTWEIGHT|SKELETON)\s*(?:===)?/i);
      const level = (levelMatch ? levelMatch[1].toUpperCase() : 'UNKNOWN') as ParsedOptimizerOutput['level'];
      if (!levelMatch) warnings.push('Missing LEVEL tag');

      const reasonMatch = trimmed.match(/^Reason:\s*(.+)$/im);
      const rawReason = reasonMatch ? reasonMatch[1].trim() : '';
      const reason = this.cleanField(rawReason);
      if (!reason) warnings.push('Missing or empty Reason field');

      const enhMatch = trimmed.match(/^Enhancements?:\s*(.+)$/im);
      const rawEnh = enhMatch ? enhMatch[1].trim() : '';
      const enhancements = this.cleanField(rawEnh);
      if (!enhancements) warnings.push('Missing or empty Enhancements field');

      const taskContent = this.extractTaskContent(trimmed);
      if (!taskContent) warnings.push('Could not isolate tightened task specification');

      return { level, reason, enhancements, taskContent, warnings };
    }

    private extractTaskContent(output: string): string {
      const taskMarker = output.match(/---TASK SPECIFICATION---\s*([\s\S]*)$/i);
      if (taskMarker?.[1]) {
        return this.stripLeadingMetadata(taskMarker[1]).trim();
      }

      const levelMatch = output.match(/(?:===\s*)?LEVEL:\s*(FULL|LIGHTWEIGHT|SKELETON)\s*(?:===)?/i);
      if (levelMatch?.index !== undefined) {
        const afterLevel = output.slice(levelMatch.index + levelMatch[0].length);
        return this.stripLeadingMetadata(afterLevel).trim();
      }

      return this.stripLeadingMetadata(output).trim();
    }

    private stripLeadingMetadata(text: string): string {
      const lines = text.split(/\r?\n/);
      const kept: string[] = [];
      let started = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!started) {
          if (
            trimmed === '' ||
            /^Enhancements?:/i.test(trimmed) ||
            /^Reason:/i.test(trimmed) ||
            /^---TASK SPECIFICATION---$/i.test(trimmed) ||
            /^===LEVEL:/i.test(trimmed)
          ) {
            continue;
          }
          started = true;
        }
        if (started) kept.push(line);
      }

      return kept.join('\n');
    }

    private cleanField(value: string): string {
      return value && !value.startsWith('<') && value !== '...' ? value : '';
    }

    private async appendParseNotes(traceFilePath: string, parsed: ParsedOptimizerOutput): Promise<void> {
      try {
        const note = [
          '',
          '---',
          '## Parser Notes',
          `- Level parsed: ${parsed.level}`,
          `- Reason: ${parsed.reason || '(missing)'}`,
          `- Enhancements: ${parsed.enhancements || '(missing)'}`,
          `- Warnings: ${parsed.warnings.join('; ')}`,
          '',
        ].join('\n');

        await fs.mkdir(path.dirname(traceFilePath), { recursive: true });
        await fs.appendFile(traceFilePath, note, 'utf8');
      } catch {
        // Non-fatal: trace logging must not break prompt generation
      }
    }

    private mergeBack(
      original: string,
      taskSections: PromptSection[],
      improvedText: string
    ): string {
      const parts = original.split(/\n\n---\n\n/);
      const improvedParts = improvedText.split(/\n\n---\n\n/);

      if (improvedParts.length === taskSections.length && taskSections.length > 0) {
        taskSections.forEach((section, i) => {
          parts[section.index] = improvedParts[i];
        });
      } else if (taskSections.length > 0) {
        parts[taskSections[0].index] = improvedText;
        for (let i = taskSections.length - 1; i > 0; i--) {
          parts.splice(taskSections[i].index, 1);
        }
      }

      return parts.join('\n\n---\n\n');
    }

    private async tightenWhole(promptText: string, apiKey: string, traceSourceText: string): Promise<{ refined: string; changeSummary: string }> {
      const trace = this.buildTraceOptions(traceSourceText, 'prompt_optimizer_fallback');
      const refined = await this.geminiService.generate(
        `Tighten this AI coding prompt. Keep all technical details. Remove only vague language. Output only the improved prompt:\n\n${promptText}`,
        apiKey,
        'flash',
        undefined,
        trace
      );
      return { refined: refined.trim(), changeSummary: 'Full prompt tightened with GPT-4o-mini fallback' };
    }
  }
