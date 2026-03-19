import { GeminiService } from './gemini.service';

export interface EvaluationResult {
  score: number;
  pass: boolean;
  summary: string;
  issues: string[];
  revisionNote: string;
}

export class RunEvaluatorService {
  constructor(private geminiService: GeminiService) {}

  async evaluate(
    taskSpec: { title: string; scope: string },
    artifacts: { jobSummary: string; changedFiles: string[]; risks: string[] },
    apiKey: string
  ): Promise<EvaluationResult> {
    const prompt = `You are a senior code reviewer evaluating the output of an AI coding agent.

TASK:
Title: ${taskSpec.title}
Scope: ${taskSpec.scope}

AGENT OUTPUT:
Summary: ${artifacts.jobSummary}
Changed Files: ${artifacts.changedFiles.slice(0, 20).join(', ')}
Risks Flagged: ${artifacts.risks.slice(0, 5).join(', ')}

Score this output 1-10:
- 10: Perfect, fully addresses task, clean changes
- 7-9: Good, mostly complete
- 4-6: Partial, has gaps or concerns
- 1-3: Poor, major issues

Return ONLY valid JSON (no markdown, no fences):
{"score":<1-10>,"pass":<true if score>=7>,"summary":"<one sentence>","issues":["<issue>"],"revisionNote":"<what to fix, or empty string>"}`;

    // Flash — structured scoring is formulaic, no deep reasoning needed
    const response = await this.geminiService.generate(prompt, apiKey, 'flash');
    try {
      // Strip any markdown fences if present
      const cleaned = response.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleaned);
      return {
        score: Number(parsed.score) || 5,
        pass: Boolean(parsed.pass),
        summary: String(parsed.summary || ''),
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        revisionNote: String(parsed.revisionNote || ''),
      };
    } catch {
      return { score: 5, pass: false, summary: 'Could not parse evaluation', issues: ['Evaluation parse failed'], revisionNote: 'Please review manually' };
    }
  }
}
