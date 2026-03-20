import * as path from 'path';
import { GeminiService } from './gemini.service';
import { extractRunFolderFromCompiledPrompt } from './optimizer-trace.utils';

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
  removeBlock: string;
  replaceBlock: string;
  addBlock: string;
  filePlanBlock: string;
  coderGuardrailsBlock: string;
  blockersBlock: string;
  warnings: string[];
  valid: boolean;
  invalidReasons: string[];
}

/**
 * PromptFuserService
 *
 * Takes the architect delta pasted back from the chat LLM, unwraps an optional
 * fenced code block, applies the delta to the canonical compiled prompt, then
 * runs a cheap final pass on the full fused prompt.
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
    const fused = parsed.valid
      ? this.applyDeltaToCanonicalPrompt(originalPrompt, parsed)
      : originalPrompt;

    let finalPassResult = 'OK';
    if (apiKey) {
      try {
        finalPassResult = await this.finalPass(fused, apiKey, trace);
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
    const unwrapped = this.unwrapSingleFencedCodeBlock(output);
    const lines = unwrapped.split(/\r?\n/);

    const parsed: ParsedLLMOutput = {
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
      valid: true,
      invalidReasons: [],
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
        parsed.level = levelMatch[1].toUpperCase() as ContextLevel;
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
        this.invalidateParsedOutput(parsed, `Unexpected content outside delta blocks: "${trimmed}"`);
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

  private applyDeltaToCanonicalPrompt(originalPrompt: string, parsed: ParsedLLMOutput): string {
    const parts = originalPrompt.split(/\n\n---\n\n/);
    const filteredParts = parts.filter(part => !this.isManagedDeltaSection(part));
    const staticIndex = filteredParts.findIndex(part => this.isStaticSection(part));
    const taskParts = filteredParts.slice(0, staticIndex === -1 ? filteredParts.length : staticIndex);
    const staticParts = filteredParts.slice(staticIndex === -1 ? filteredParts.length : staticIndex);

    let taskContent = taskParts.join('\n\n---\n\n').trim();
    taskContent = this.applyRemoveEntries(taskContent, parsed);
    taskContent = this.applyReplaceEntries(taskContent, parsed);
    taskContent = this.applyAddEntries(taskContent, parsed);

    const fusedParts: string[] = [taskContent];
    const filePlan = parsed.filePlanBlock.trim();
    const guardrails = parsed.coderGuardrailsBlock.trim();
    const blockers = parsed.blockersBlock.trim();

    if (filePlan) fusedParts.push(this.buildSection('FILE PLAN', filePlan));
    if (guardrails) fusedParts.push(this.buildSection('CODER GUARDRAILS', guardrails));
    if (blockers && !this.isExplicitNone(blockers)) fusedParts.push(this.buildSection('BLOCKERS', blockers));

    fusedParts.push(...staticParts);
    return fusedParts.filter(Boolean).join('\n\n---\n\n');
  }

  private applyRemoveEntries(text: string, parsed: ParsedLLMOutput): string {
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

  private applyReplaceEntries(text: string, parsed: ParsedLLMOutput): string {
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

  private applyAddEntries(text: string, parsed: ParsedLLMOutput): string {
    const entries = this.parseLineEntries(parsed.addBlock);
    if (entries.length === 0) return text;

    let working = text;
    for (const entry of entries) {
      if (this.isExplicitNone(entry)) continue;
      const match = this.parseAddEntry(entry);
      if (!match) {
        this.invalidateParsedOutput(parsed, `ADD entry has invalid syntax: "${entry}"`);
        continue;
      }
      const { sectionName, value } = match;
      const result = this.insertIntoCanonicalSection(working, sectionName, value);
      working = result.text;
      if (!result.applied) {
        parsed.warnings.push(`ADD target section missing: "${sectionName}"`);
      }
    }
    return working;
  }

  private parseLineEntries(block: string): string[] {
    if (!block) return [];
    return block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  }

  private validateAddBlock(parsed: ParsedLLMOutput): void {
    for (const entry of this.parseLineEntries(parsed.addBlock)) {
      if (this.isExplicitNone(entry)) continue;
      if (!this.parseAddEntry(entry)) {
        this.invalidateParsedOutput(parsed, `ADD entry has invalid syntax: "${entry}"`);
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

  private invalidateParsedOutput(parsed: ParsedLLMOutput, reason: string): void {
    parsed.warnings.push(reason);
    parsed.invalidReasons.push(reason);
    parsed.valid = false;
  }

  private isExplicitNone(value: string): boolean {
    return value.trim().toUpperCase() === 'NONE';
  }

  private buildSection(title: string, body: string): string {
    return `# ${title}\n\n${body.trim()}`;
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

    if (lines.some(line => line.trim() === value)) return { text, applied: true };

    lines.splice(insertAt, 0, value);
    return { text: lines.join('\n'), applied: true };
  }

  private isStaticSection(part: string): boolean {
    const headerMatch = part.match(/^#+ (.+)/m);
    const header = headerMatch ? headerMatch[1].trim().toUpperCase() : '';
    return STATIC_HEADERS.some(s => header.includes(s));
  }

  private isManagedDeltaSection(part: string): boolean {
    const headerMatch = part.match(/^#\s+(.+)/m);
    const header = headerMatch ? headerMatch[1].trim().toUpperCase() : '';
    return header === 'FILE PLAN' || header === 'CODER GUARDRAILS' || header === 'BLOCKERS';
  }

  private async finalPass(
    fusedPrompt: string,
    apiKey: string,
    trace?: { traceFilePath?: string }
  ): Promise<string> {
    const result = await this.geminiService.generate(
      `Review this AI coding task prompt.

Output ONLY one of:
- The single word: OK
- A bullet list of specific improvements needed (max 5, be concrete - no rewrites)

No commentary. No preamble. Just "OK" or bullet issues:

${fusedPrompt}`,
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
