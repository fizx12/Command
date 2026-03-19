import * as fs from 'fs/promises';
import * as https from 'https';
import * as path from 'path';
import { randomUUID } from 'crypto';

/**
 * Model tier used when calling the AI service.
 * flash  = gpt-4o-mini  — fast, cheap.  Use for mechanical tasks (eval, ping).
 * pro    = gpt-5.4      — smarter.      Use for tightening, bootstrap, coding.
 */
export type ModelTier = 'flash' | 'pro';

/**
 * Settings shape — only the fields this service cares about.
 */
export interface AISettings {
  openaiApiKey?: string;
  flashModel?: string;    // default: gpt-4o-mini
  proModel?: string;      // default: gpt-5.4
  // Gemini — kept for future use, not called unless geminiEnabled
  geminiApiKey?: string;
  geminiEnabled?: boolean;
  geminiFlashModel?: string;
  geminiProModel?: string;
}

export interface GenerateTraceOptions {
  label?: string;
  traceFilePath?: string;
  metadata?: Record<string, string>;
}

export class GeminiService {
  private settings: AISettings;

  constructor(settings: AISettings = {}) {
    this.settings = settings;
  }

  /** Hot-reload settings without rebuilding the service. */
  updateSettings(settings: AISettings): void {
    this.settings = settings;
  }

  /**
   * Generate text using OpenAI.
   *
   * @param prompt     The full prompt text.
   * @param apiKey     OpenAI API key (overrides settings if provided).
   * @param tier       'flash' → gpt-4o-mini, 'pro' → gpt-5.4
   * @param maxTokens  Override output token limit.
   */
  async generate(
    prompt: string,
    apiKey: string,
    tier: ModelTier = 'flash',
    maxTokens?: number,
    trace?: GenerateTraceOptions
  ): Promise<string> {
    const key = (apiKey?.trim() || this.settings.openaiApiKey?.trim() || '').trim();
    if (!key) throw new Error('OpenAI API key is required. Add it in Settings → OpenAI API Key.');

    const model = tier === 'pro'
      ? (this.settings.proModel || 'gpt-5.4')
      : (this.settings.flashModel || 'gpt-4o-mini');

    const outputTokens = maxTokens ?? (tier === 'pro' ? 8192 : 4096);

    return this._callOpenAI(key, model, prompt, outputTokens, tier, trace);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async _callOpenAI(
    apiKey: string,
    model: string,
    prompt: string,
    maxTokens: number,
    tier: ModelTier,
    trace?: GenerateTraceOptions
  ): Promise<string> {
    const callId = randomUUID().slice(0, 8);
    this.logCallStart(callId, model, tier, prompt, trace);

    const body = JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: maxTokens,
      temperature: 0.2,
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', async () => {
          try {
            if (res.statusCode && res.statusCode >= 400) {
              let msg = `OpenAI API error ${res.statusCode}`;
              try {
                const err = JSON.parse(data);
                if (err.error?.message) msg = err.error.message;
              } catch { /* keep default */ }
              const error = new Error(msg);
              await this.logCallEnd(callId, model, tier, prompt, '', trace, error);
              reject(error);
              return;
            }
            const response = JSON.parse(data);
            const text = response.choices?.[0]?.message?.content;
            if (!text) {
              const reason = response.choices?.[0]?.finish_reason;
              const error = new Error(`Empty OpenAI response${reason ? ` (finish_reason: ${reason})` : ''}`);
              await this.logCallEnd(callId, model, tier, prompt, '', trace, error);
              reject(error);
              return;
            }
            await this.logCallEnd(callId, model, tier, prompt, text, trace);
            resolve(text);
          } catch (error) {
            const parseError = new Error(`Failed to parse OpenAI response: ${error instanceof Error ? error.message : String(error)}`);
            await this.logCallEnd(callId, model, tier, prompt, '', trace, parseError);
            reject(parseError);
          }
        });
      });

      req.on('error', (error) => {
        const wrapped = new Error(`OpenAI API request failed: ${error.message}`);
        void this.logCallEnd(callId, model, tier, prompt, '', trace, wrapped);
        reject(wrapped);
      });

      req.write(body);
      req.end();
    });
  }

  private logCallStart(
    callId: string,
    model: string,
    tier: ModelTier,
    prompt: string,
    trace?: GenerateTraceOptions
  ): void {
    const label = trace?.label || 'ai_call';
    console.log([
      `\n[AI:${label}] START ${callId}`,
      `Model: ${model}`,
      `Tier: ${tier}`,
      trace?.metadata ? `Metadata: ${JSON.stringify(trace.metadata)}` : '',
      '--- PROMPT BEGIN ---',
      prompt,
      '--- PROMPT END ---',
    ].filter(Boolean).join('\n'));
  }

  private async logCallEnd(
    callId: string,
    model: string,
    tier: ModelTier,
    prompt: string,
    response: string,
    trace?: GenerateTraceOptions,
    error?: Error
  ): Promise<void> {
    const label = trace?.label || 'ai_call';
    if (error) {
      console.error([
        `[AI:${label}] ERROR ${callId}`,
        `Model: ${model}`,
        `Tier: ${tier}`,
        error.message,
      ].join('\n'));
    } else {
      console.log([
        `[AI:${label}] END ${callId}`,
        `Model: ${model}`,
        `Tier: ${tier}`,
        '--- RESPONSE BEGIN ---',
        response,
        '--- RESPONSE END ---',
      ].join('\n'));
    }

    if (!trace?.traceFilePath) return;

    const block = this.buildTraceBlock({
      callId,
      label,
      model,
      tier,
      prompt,
      response,
      metadata: trace.metadata,
      error,
    });

    try {
      await fs.mkdir(path.dirname(trace.traceFilePath), { recursive: true });
      await fs.appendFile(trace.traceFilePath, block, 'utf8');
    } catch (traceError) {
      console.error('[AI Trace] Failed to write trace file:', traceError);
    }
  }

  private buildTraceBlock(input: {
    callId: string;
    label: string;
    model: string;
    tier: ModelTier;
    prompt: string;
    response: string;
    metadata?: Record<string, string>;
    error?: Error;
  }): string {
    const lines: string[] = [];
    lines.push('');
    lines.push('---');
    lines.push(`## ${input.label} :: ${input.callId}`);
    lines.push(`- Model: ${input.model}`);
    lines.push(`- Tier: ${input.tier}`);
    lines.push(`- Timestamp: ${new Date().toISOString()}`);
    if (input.metadata && Object.keys(input.metadata).length > 0) {
      lines.push(`- Metadata: ${JSON.stringify(input.metadata)}`);
    }
    if (input.error) {
      lines.push(`- Error: ${input.error.message}`);
    }
    lines.push('');
    lines.push('> Prompt sent to the optimizer/API');
    lines.push('~~~text');
    lines.push(input.prompt.trimEnd());
    lines.push('~~~');
    lines.push('');
    lines.push('> Raw output returned by the API');
    lines.push('~~~text');
    lines.push((input.response || '').trimEnd());
    lines.push('~~~');
    lines.push('');
    return lines.join('\n');
  }

  // ─── Static helpers ─────────────────────────────────────────────────────────

  /**
   * Parse file blocks from a response string.
   * Format: ===FILE: filename.ext===\n{content}\n===ENDFILE===
   */
  static parseFileBlocks(response: string): Record<string, string> {
    const files: Record<string, string> = {};
    const fileRegex = /===FILE:\s*(.+?)\s*===\n([\s\S]*?)\n===ENDFILE===/g;
    let match;
    while ((match = fileRegex.exec(response)) !== null) {
      files[match[1].trim()] = match[2].trim();
    }
    return files;
  }
}
