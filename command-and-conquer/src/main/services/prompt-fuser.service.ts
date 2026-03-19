import * as path from 'path';
import { GeminiService } from './gemini.service';
import { extractRunFolderFromCompiledPrompt, extractTaskSectionsFromCompiledPrompt } from './optimizer-trace.utils';

const STATIC_HEADERS = [
  'GLOBAL RULES',
  'COMMAND & CONQUER',
  'OUTPUT FORMAT',
  'OUTPUT LOCATION',
  'AGENT ROLE',
  'AGENT DEFINITION',
];

export type ContextLevel = 'FULL' | 'LIGHTWEIGHT' | 'SKELETON' | 'UNKNOWN';

export interface FuseResult {
  fused: string;
  level: ContextLevel;
  reason: string;
  enhancements: string;
  finalPassResult: string;
}

interface ParsedLLMOutput {
  level: ContextLevel;
  reason: string;
  enhancements: string;
  taskContent: string;
  warnings: string[];
}

/**
 * PromptFuserService
 *
 * Takes the result pasted back from a chat LLM after the manual tighten flow,
 * fuses the LLM-chosen task content back with the static boilerplate sections
 * from the original compiled prompt, then runs a cheap gpt-4o-mini final pass.
 */
export class PromptFuserService {
  constructor(private geminiService: GeminiService) {}

  async fuse(
    originalPrompt: string,
    llmOutput: string,
    apiKey: string
  ): Promise<FuseResult> {
    const parsed = this.parseLLMOutput(llmOutput);
    const trace = this.buildTraceOptions(originalPrompt);
    const originalTaskSections = extractTaskSectionsFromCompiledPrompt(originalPrompt);
    const taskContent = parsed.taskContent.trim() || originalTaskSections;

    const fused = this.mergeWithStatics(originalPrompt, taskContent);

    let finalPassResult = 'OK';
    if (apiKey) {
      try {
        finalPassResult = await this.finalPass(taskContent, apiKey, trace);
      } catch {
        // non-fatal
      }
    }

    if (trace?.traceFilePath && parsed.warnings.length > 0) {
      await this.appendParseNotes(trace.traceFilePath, parsed);
    }

    return {
      fused,
      level: parsed.level,
      reason: parsed.reason,
      enhancements: parsed.enhancements,
      finalPassResult,
    };
  }

  private parseLLMOutput(output: string): ParsedLLMOutput {
    const warnings: string[] = [];
    const trimmed = output.trim();

    const levelMatch = trimmed.match(/(?:===\s*)?LEVEL:\s*(FULL|LIGHTWEIGHT|SKELETON)\s*(?:===)?/i);
    const level = (levelMatch ? levelMatch[1].toUpperCase() : 'UNKNOWN') as ContextLevel;
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

  private mergeWithStatics(originalPrompt: string, taskContent: string): string {
    const parts = originalPrompt.split(/\n\n---\n\n/);
    const staticParts = parts.filter(part => {
      const headerMatch = part.match(/^#+ (.+)/m);
      const header = headerMatch ? headerMatch[1].trim().toUpperCase() : '';
      return STATIC_HEADERS.some(s => header.includes(s));
    });

    return [taskContent, ...staticParts].join('\n\n---\n\n');
  }

  private async finalPass(
    taskContent: string,
    apiKey: string,
    trace?: { traceFilePath?: string }
  ): Promise<string> {
    const result = await this.geminiService.generate(
      `Review this AI coding task prompt.

Output ONLY one of:
- The single word: OK
- A bullet list of specific improvements needed (max 5, be concrete - no rewrites)

No commentary. No preamble. Just "OK" or bullet issues:

${taskContent}`,
      apiKey,
      'flash',
      undefined,
      trace?.traceFilePath ? {
        label: 'optimizer_final_pass',
        traceFilePath: trace.traceFilePath,
      } : undefined
    );
    return result.trim();
  }

  private buildTraceOptions(originalPrompt: string): { traceFilePath?: string } | undefined {
    const runFolder = extractRunFolderFromCompiledPrompt(originalPrompt);
    if (!runFolder) return undefined;
    return {
      traceFilePath: path.join(runFolder, 'optimizer_trace.md'),
    };
  }

  private async appendParseNotes(
    traceFilePath: string,
    parsed: ParsedLLMOutput
  ): Promise<void> {
    try {
      const fs = await import('fs/promises');
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
      // Non-fatal trace write failure
    }
  }
}
