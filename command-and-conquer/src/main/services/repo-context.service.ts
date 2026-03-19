import * as fs from 'fs';
import * as path from 'path';
import { GeminiService } from './gemini.service';
import { FileStore } from '../storage/file-store';

// ─── Filters ──────────────────────────────────────────────────────────────────

/** Directories that are never scanned */
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'coverage', '.next', 'out',
  '.cache', '__pycache__', '.turbo', '.vite', '.svelte-kit', '.nuxt',
  '.output', 'vendor', 'target', 'bin', 'obj', 'tmp', 'temp', 'logs',
]);

/** File extensions that are included */
const INCLUDE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mts', '.cts',
  '.py', '.go', '.rs', '.java', '.cs', '.rb', '.php',
  '.vue', '.svelte',
  '.md', '.json', '.yaml', '.yml', '.toml', '.env.example',
]);

/** Specific filenames always included (regardless of extension) */
const INCLUDE_NAMES = new Set([
  'package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js',
  'webpack.config.js', 'rollup.config.js', '.eslintrc.json', 'README.md',
  'Cargo.toml', 'go.mod', 'pyproject.toml', 'requirements.txt',
]);

/** Files/patterns to always skip */
const SKIP_SUFFIXES = [
  '.min.js', '.min.css', '.d.ts', '.map', '.lock',
  '.log', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg',
  '.webp', '.woff', '.woff2', '.ttf', '.eot',
  '.exe', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz',
  '.db', '.sqlite', '.DS_Store',
];

const SKIP_EXACT = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
]);

/** Test file patterns (deprioritised when over token budget) */
const TEST_PATTERNS = ['.test.', '.spec.', '__tests__', '__mocks__', '.stories.'];

const MAX_LINES_PER_FILE = 400;
const MAX_TOTAL_CHARS = 80_000;

// ─── Service ──────────────────────────────────────────────────────────────────

export class RepoContextService {
  constructor(
    private geminiService: GeminiService,
    private fileStore: FileStore,
  ) {}

  /**
   * Scan the repo, build a compact file representation, call gpt-4o-mini to
   * synthesise a REPO CONTEXT document, save it, and return the text.
   */
  async generateContext(
    projectId: string,
    repoPath: string,
    apiKey: string,
  ): Promise<{ context: string; filesScanned: number }> {
    if (!fs.existsSync(repoPath)) {
      throw new Error(`Repo path does not exist: ${repoPath}`);
    }

    const { content, filesScanned } = this.buildFileBundle(repoPath);

    const context = await this.geminiService.generate(
      this.buildPrompt(content),
      apiKey,
      'flash', // gpt-4o-mini — cheap, good at structured summarisation
      2048,
    );

    const trimmed = context.trim();

    // Save alongside existing knowledge docs so PromptCompiler picks it up
    await this.fileStore.writeMarkdown(
      `workspace/projects/${projectId}/knowledge/docs/REPO_CONTEXT.md`,
      trimmed,
    );

    return { context: trimmed, filesScanned };
  }

  // ─── File scanning ──────────────────────────────────────────────────────────

  private buildFileBundle(repoPath: string): { content: string; filesScanned: number } {
    const allFiles = this.walkDir(repoPath);

    // Split into primary (non-test) and secondary (test) files
    const primary = allFiles.filter(f => !TEST_PATTERNS.some(p => f.includes(p)));
    const secondary = allFiles.filter(f => TEST_PATTERNS.some(p => f.includes(p)));

    const ordered = [...primary, ...secondary];
    const chunks: string[] = [];
    let totalChars = 0;
    let filesScanned = 0;

    for (const filePath of ordered) {
      if (totalChars >= MAX_TOTAL_CHARS) break;

      const rel = path.relative(repoPath, filePath).replace(/\\/g, '/');
      const raw = this.readFileCapped(filePath);
      if (!raw) continue;

      const chunk = `### ${rel}\n${raw}`;
      if (totalChars + chunk.length > MAX_TOTAL_CHARS) {
        // Include partial if it's a priority file, otherwise skip
        if (this.isPriority(rel)) {
          const remaining = MAX_TOTAL_CHARS - totalChars;
          chunks.push(chunk.slice(0, remaining) + '\n[... truncated]');
        }
        break;
      }

      chunks.push(chunk);
      totalChars += chunk.length;
      filesScanned++;
    }

    return { content: chunks.join('\n\n'), filesScanned };
  }

  private walkDir(dir: string): string[] {
    const results: string[] = [];
    let entries: fs.Dirent[];

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return results;
    }

    // Sort: index/main files first, then alphabetical
    entries.sort((a, b) => {
      const aP = this.isPriority(a.name) ? 0 : 1;
      const bP = this.isPriority(b.name) ? 0 : 1;
      return aP - bP || a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          results.push(...this.walkDir(fullPath));
        }
      } else if (entry.isFile()) {
        if (this.shouldInclude(entry.name)) {
          results.push(fullPath);
        }
      }
    }

    return results;
  }

  private shouldInclude(filename: string): boolean {
    if (SKIP_EXACT.has(filename)) return false;
    if (SKIP_SUFFIXES.some(s => filename.endsWith(s))) return false;
    if (INCLUDE_NAMES.has(filename)) return true;
    const ext = path.extname(filename).toLowerCase();
    return INCLUDE_EXTS.has(ext);
  }

  private isPriority(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.startsWith('index') || lower.startsWith('main') ||
           lower.startsWith('app') || lower === 'package.json' ||
           lower.startsWith('readme');
  }

  private readFileCapped(filePath: string): string | null {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const lines = raw.split('\n');
      if (lines.length <= MAX_LINES_PER_FILE) return raw;
      return lines.slice(0, MAX_LINES_PER_FILE).join('\n') +
             `\n[... ${lines.length - MAX_LINES_PER_FILE} lines truncated]`;
    } catch {
      return null;
    }
  }

  // ─── Prompt ────────────────────────────────────────────────────────────────

  private buildPrompt(fileContents: string): string {
    return `Analyze this codebase and produce a compact REPO CONTEXT block for an AI coding agent.
This context travels in every coding task prompt — keep it dense and useful.

Output ONLY this structure (no preamble, no other text):

# REPO CONTEXT

## File Map
\`path\` — one-line purpose
(key files only — skip trivial config or auto-generated files)

## Architecture
- key pattern or module connection
(4 bullets max)

## Key Types
\`TypeName\` — fields in brief
(only types/interfaces used across multiple files)

## Entry Points
\`path\` — what it initializes or exports

## Conventions
- non-obvious rule or pattern
(3 bullets max)

---REPO FILES---
${fileContents}`;
  }
}
