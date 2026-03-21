import * as fs from 'fs/promises';
import * as path from 'path';
import { FileStore } from '../storage/file-store';
import { GeminiService } from './gemini.service';

interface BootstrapResult {
  updated: string[];
  errors: string[];
  repoKnowledgePath: string;
  repoKnowledgeAbsolutePath: string;
  repoDocsPath: string;
  workspaceKnowledgePath: string;
  workspaceKnowledgeAbsolutePath: string;
  workspaceDocsPath: string;
}

interface FileInfo {
  relativePath: string;
  content: string;
}

interface CollectedFile extends FileInfo {
  absolutePath: string;
  priority: number;
}

type BootstrapPromptBucket = 'manifests' | 'entrypoints' | 'architecture' | 'runtime' | 'docs';

interface PromptFileEntry {
  relativePath: string;
  bucket: BootstrapPromptBucket;
  priority: number;
  reason: string;
  snippet: string;
}

type BootstrapRepoProfile = 'python' | 'script-heavy' | 'electron-frontend' | 'library-package';

interface BootstrapRepoSignals {
  python: number;
  'script-heavy': number;
  'electron-frontend': number;
  'library-package': number;
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', 'knowledge']);
const INCLUDE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.json', '.md']);
const SKIP_FILES = new Set(['package-lock.json', 'yarn.lock']);

export class BootstrapKnowledgeService {
  constructor(private fileStore: FileStore, private geminiService: GeminiService) {}

  async bootstrap(
    projectId: string,
    sourcePath: string,
    apiKey: string,
    modelOverride?: string
  ): Promise<BootstrapResult> {
    try {
      const repoRoot = await fs.realpath(sourcePath);
      const repoKnowledgePath = path.join(repoRoot, 'knowledge');
      const repoKnowledgeAbsolutePath = repoKnowledgePath;
      const repoDocsPath = path.join(repoKnowledgePath, 'docs');
      const workspaceKnowledgePath = `workspace/projects/${projectId}/knowledge`;
      const workspaceKnowledgeAbsolutePath = this.fileStore.resolvePath(workspaceKnowledgePath);
      const workspaceDocsPath = `${workspaceKnowledgePath}/docs`;

      // Recursively read files from sourcePath
      const files = await this.collectFiles(repoRoot);

      if (files.length === 0) {
        return {
          updated: [],
          errors: ['No suitable source files found'],
          repoKnowledgePath,
          repoKnowledgeAbsolutePath,
          repoDocsPath,
          workspaceKnowledgePath,
          workspaceKnowledgeAbsolutePath,
          workspaceDocsPath,
        };
      }

      // Limit to max 150 files and 200KB total
      const limitedFiles = this.limitFiles(files);

      // Build structured prompt representation
      const prompt = this.buildBootstrapPrompt(limitedFiles);

      // Bootstrap docs are model-selectable; use the configured model override when provided.
      const response = await this.geminiService.generate(prompt, apiKey, 'pro', 8192, undefined, modelOverride);

      // Parse file blocks
      const parsedFiles = GeminiService.parseFileBlocks(response);
      const requiredDocs = ['APP_PRIMER.md', 'SOURCE_OF_TRUTH_INDEX.md', 'carry_forward.md'];
      const missingDocs = requiredDocs.filter((filename) => {
        const content = parsedFiles[filename];
        return typeof content !== 'string' || content.trim().length === 0;
      });
      if (missingDocs.length > 0) {
        return {
          updated: [],
          errors: [`Missing required bootstrap document(s): ${missingDocs.join(', ')}`],
          repoKnowledgePath,
          repoKnowledgeAbsolutePath,
          repoDocsPath,
          workspaceKnowledgePath,
          workspaceKnowledgeAbsolutePath,
          workspaceDocsPath,
        };
      }

      // Write files to knowledge/docs in both the app workspace and the selected repo root.
      const updated: string[] = [];
      for (const [filename, content] of Object.entries(parsedFiles)) {
        try {
          const workspaceDocPath = `workspace/projects/${projectId}/knowledge/docs/${filename}`;
          const repoDocPath = path.join(sourcePath, 'knowledge', 'docs', filename);
          await Promise.all([
            this.fileStore.writeMarkdown(workspaceDocPath, content),
            this.writeMarkdownAbsolute(repoDocPath, content),
          ]);
          updated.push(filename);
        } catch (error) {
          console.error(`Failed to write ${filename}:`, error);
        }
      }

      return {
        updated,
        errors: [],
        repoKnowledgePath,
        repoKnowledgeAbsolutePath,
        repoDocsPath,
        workspaceKnowledgePath,
        workspaceKnowledgeAbsolutePath,
        workspaceDocsPath,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        updated: [],
        errors: [errorMsg],
        repoKnowledgePath: path.join(sourcePath, 'knowledge'),
        repoKnowledgeAbsolutePath: path.join(sourcePath, 'knowledge'),
        repoDocsPath: path.join(sourcePath, 'knowledge', 'docs'),
        workspaceKnowledgePath: `workspace/projects/${projectId}/knowledge`,
        workspaceKnowledgeAbsolutePath: this.fileStore.resolvePath(`workspace/projects/${projectId}/knowledge`),
        workspaceDocsPath: `workspace/projects/${projectId}/knowledge/docs`,
      };
    }
  }

  private async collectFiles(sourcePath: string): Promise<FileInfo[]> {
    const files: CollectedFile[] = [];
    const stack = [sourcePath];
    const visitedDirs = new Set<string>();

    while (stack.length > 0) {
      const currentPath = stack.pop()!;
      const resolvedCurrent = await this.safeRealpath(currentPath);
      if (!resolvedCurrent || visitedDirs.has(resolvedCurrent)) {
        continue;
      }
      if (!this.isInsideRoot(sourcePath, resolvedCurrent)) {
        continue;
      }
      visitedDirs.add(resolvedCurrent);

      try {
        const entries = await fs.readdir(resolvedCurrent, { withFileTypes: true });
        entries.sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of entries) {
          if (this.shouldSkipDirectory(entry.name)) {
            continue;
          }

          const fullPath = path.join(resolvedCurrent, entry.name);

          if (entry.isSymbolicLink()) {
            continue;
          }

          if (entry.isDirectory()) {
            const resolvedChild = await this.safeRealpath(fullPath);
            if (resolvedChild && this.isInsideRoot(sourcePath, resolvedChild)) {
              stack.push(resolvedChild);
            }
            continue;
          }

          if (!entry.isFile()) {
            continue;
          }

          if (!this.shouldIncludeFile(entry.name)) {
            continue;
          }

          const resolvedFile = await this.safeRealpath(fullPath);
          if (!resolvedFile || !this.isInsideRoot(sourcePath, resolvedFile)) {
            continue;
          }

          try {
            const content = await fs.readFile(resolvedFile, 'utf-8');
            const relativePath = path.relative(sourcePath, resolvedFile).replace(/\\/g, '/');
            files.push({
              absolutePath: resolvedFile,
              relativePath,
              content,
              priority: this.getFilePriority(relativePath, content),
            });
          } catch {
            // Skip files that can't be read
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    }

    return files
      .sort((a, b) => b.priority - a.priority || a.relativePath.localeCompare(b.relativePath))
      .map(({ relativePath, content }) => ({ relativePath, content }));
  }

  private shouldIncludeFile(filename: string): boolean {
    if (SKIP_FILES.has(filename)) {
      return false;
    }

    const ext = path.extname(filename).toLowerCase();
    return INCLUDE_EXTENSIONS.has(ext);
  }

  private shouldSkipDirectory(name: string): boolean {
    return SKIP_DIRS.has(name) || name === 'knowledge' || name.startsWith('.git');
  }

  private async safeRealpath(targetPath: string): Promise<string | null> {
    try {
      return await fs.realpath(targetPath);
    } catch {
      return null;
    }
  }

  private isInsideRoot(root: string, candidate: string): boolean {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  }

  private getFilePriority(relativePath: string, content: string, signals?: BootstrapRepoSignals): number {
    const repoSignals = signals || this.detectBootstrapRepoSignals([{ relativePath, content }]);
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);
    const segments = lower.split('/').filter(Boolean);
    let score = 0;

    if (baseName === 'package.json') score += 200;
    if (baseName === 'readme.md' && !lower.includes('/')) score += 150;
    if (['pyproject.toml', 'requirements.txt', 'setup.py', 'pipfile', 'poetry.lock'].includes(baseName)) score += 185;
    if (/^tsconfig(\..*)?\.json$/.test(baseName)) score += 175;
    if (/^vite\.config\.(ts|js|mts|cts|mjs|cjs)$/.test(baseName)) score += 170;
    if (baseName === 'electron-builder.json' || baseName === 'postcss.config.js' || baseName === 'tailwind.config.js') score += 165;

    if (repoSignals.python > 0) {
      if (['pyproject.toml', 'requirements.txt', 'setup.py', 'pipfile', 'poetry.lock'].includes(baseName)) score += 45;
      if (/^(main|app|cli|server)\.py$/.test(baseName) || baseName === '__main__.py') score += 35;
      if (/__init__\.py$/.test(baseName)) score += 18;
    }

    if (repoSignals['script-heavy'] > 0) {
      if (baseName === 'package.json') score += 30;
      if (this.isShellOrRunnerFile(relativePath, content) || this.isBinOrCLIFile(relativePath)) score += 30;
      if (segments.some((segment) => ['scripts', 'tools', 'tooling', 'bin', 'cli', 'task', 'tasks'].includes(segment))) score += 18;
      if (/(?:build|start|dev|run|package|bootstrap|setup)/i.test(content)) score += 10;
    }

    if (repoSignals['electron-frontend'] > 0) {
      if (baseName === 'package.json') score += 28;
      if (/^vite\.config\.(ts|js|mts|cts|mjs|cjs)$/.test(baseName)) score += 35;
      if (baseName === 'electron-builder.json') score += 24;
      if (lower.includes('/main/') || lower.includes('/renderer/') || lower.includes('/preload/') || lower.includes('/ipc/')) score += 35;
      if (/ipcMain\.handle\(|ipcRenderer\.invoke\(|contextBridge\.exposeInMainWorld/.test(content)) score += 45;
      if (/(?:<Route[^>]*path=|\bpath:\s*["'][^"']+["']|\bto:\s*["'][^"']+["'])/.test(content)) score += 22;
      if (/zustand|create\(|set[A-Z][A-Za-z0-9_]+/i.test(content)) score += 22;
      if (/(?:app|main|renderer|router)\.(?:tsx|ts)$/i.test(baseName)) score += 30;
    }

    if (repoSignals['library-package'] > 0) {
      if (baseName === 'package.json') score += 25;
      if (this.isLibraryStylePath(relativePath)) score += 34;
      if (/^(?:src\/)?index\.(ts|tsx|js|jsx|mts|cts)$/.test(lower) || baseName === 'mod.ts') score += 30;
      if (/export\s+(const|function|class)\s+/i.test(content) || /export\s*{\s*[^}]+\s*}/.test(content)) score += 14;
    }

    if (segments.some((segment) => ['main', 'renderer', 'preload', 'ipc', 'routes', 'router', 'stores', 'services'].includes(segment))) score += 48;
    if (lower.includes('/main/') || lower.includes('/renderer/') || lower.includes('/preload/')) score += 44;
    if (/ipcMain\.handle\(|ipcRenderer\.invoke\(|contextBridge\.exposeInMainWorld/.test(content)) score += 55;
    if (/route\s*[:=]|<Route[^>]*path=|react-router-dom/i.test(content)) score += 28;
    if (/zustand|create\(|set[A-Z][A-Za-z0-9_]+/i.test(content)) score += 24;
    if (/export\s+default\s+/i.test(content)) score += 12;
    if (segments.some((segment) => ['scripts', 'tools', 'tooling', 'bin', 'cli', 'task', 'tasks', 'maintenance', 'migrations', 'ops', 'dev'].includes(segment))) score -= 35;
    if (/(?:^|[._-])(test|spec|debug|draft|copy|backup|archive|old)(?:[._-]|$)/.test(baseName)) score -= 60;
    if (lower.includes('/knowledge/') || lower.includes('/prompt-history/')) score -= 120;
    if (/app_primer\.md|source_of_truth_index\.md|repo_context\.md|full_repo_context\.json|carry_forward\.md|job_summary\.md|review_checklist\.json|changed_files\.json|job_result\.json|code_snippets\.md/.test(baseName)) score -= 140;
    if (baseName.endsWith('.log')) score -= 80;
    if (baseName.endsWith('.bak') || baseName.endsWith('.old') || baseName.endsWith('.backup') || baseName.endsWith('.orig') || baseName.endsWith('.copy')) score -= 50;

    return score;
  }

  private isRequiredSourceFile(relativePath: string): boolean {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);
    return baseName === 'package.json' ||
      baseName === 'readme.md' ||
      ['pyproject.toml', 'requirements.txt', 'setup.py', 'pipfile', 'poetry.lock'].includes(baseName) ||
      /^tsconfig(\..*)?\.json$/.test(baseName) ||
      /^vite\.config\.(ts|js|mts|cts|mjs|cjs)$/.test(baseName) ||
      baseName === 'electron-builder.json' ||
      baseName === 'postcss.config.js' ||
      baseName === 'tailwind.config.js' ||
      lower.includes('/main/') ||
      lower.includes('/renderer/') ||
      lower.includes('/preload/') ||
      lower.includes('/ipc/') ||
      lower.includes('/routes/') ||
      lower.includes('/router/') ||
      lower.includes('/stores/') ||
      lower.includes('/services/') ||
      lower.includes('/src/index') ||
      lower.endsWith('app.tsx') ||
      lower.endsWith('main.tsx') ||
      lower.endsWith('renderer.tsx') ||
      lower.endsWith('router.tsx') ||
      lower.endsWith('preload.ts');
  }

  private limitFiles(files: FileInfo[]): FileInfo[] {
    const MAX_FILES = 150;
    const MAX_TOTAL_SIZE = 200 * 1024; // 200KB
    const MAX_FILE_SIZE = 8 * 1024; // 8KB per file

    let totalSize = 0;
    const limited: FileInfo[] = [];
    const prioritized = files.slice().sort((a, b) => {
      const aRequired = this.isRequiredSourceFile(a.relativePath) ? 1 : 0;
      const bRequired = this.isRequiredSourceFile(b.relativePath) ? 1 : 0;
      if (aRequired !== bRequired) {
        return bRequired - aRequired;
      }
      return this.getFilePriority(b.relativePath, b.content) - this.getFilePriority(a.relativePath, a.content) || a.relativePath.localeCompare(b.relativePath);
    });

    for (const file of prioritized) {
      if (limited.length >= MAX_FILES) {
        break;
      }

      let content = file.content;
      if (content.length > MAX_FILE_SIZE) {
        content = content.substring(0, MAX_FILE_SIZE) + '\n... (truncated)';
      }

      const newSize = totalSize + content.length;
      if (newSize > MAX_TOTAL_SIZE) {
        break;
      }

      limited.push({
        ...file,
        content,
      });

      totalSize = newSize;
    }

    return limited;
  }

  private buildBootstrapPrompt(files: FileInfo[]): string {
    const selected = this.organizeBootstrapFiles(files);
    const promptSections = [
      this.formatRepoProfile(selected.signals),
      this.formatRepoSummary(selected),
      this.formatPromptBucket('Manifests & Config', selected.manifests),
      this.formatPromptBucket('Entrypoints', selected.entrypoints),
      this.formatPromptBucket('Architecture Signals', selected.architecture),
      this.formatPromptBucket('Runtime Source', selected.runtime),
      this.formatPromptBucket('Selected Docs', selected.docs),
    ].filter(Boolean).join('\n\n');

    return `You are generating bootstrap knowledge docs for future coding agents.

Use ONLY the structured input below.
Do NOT invent files, modules, routes, APIs, workflows, or features.
If something is unclear, omit it or place it in Open Questions.
Return EXACTLY 3 file blocks and nothing else.
Do NOT include code snippets in the output docs.
Base every statement on the structured input.

## Structured Input

${promptSections}

## Required Output

Return EXACTLY these three files and nothing else.

===FILE: APP_PRIMER.md===
# APP PRIMER - {Project Name}

## What This Is
- concise purpose
- stack
- repo type if clear

## Core Architecture
- main layers/modules
- major runtime boundaries
- important runtime flow

## Key Patterns
- conventions
- state/data patterns
- IPC/API patterns if present

## Critical Invariants
- contracts/behaviors that must not break

## Current State
- what appears implemented
- rough edges only if evidenced
===ENDFILE===

===FILE: SOURCE_OF_TRUTH_INDEX.md===
# SOURCE OF TRUTH INDEX

## Key Files
- \`path\` - exact ownership/role

## Data Flow
- concrete flow only if evidenced

## State Management
- where state appears to live and how it changes

## Entry Points
- main runtime entry files
- app/router entry files
- public package entry files if relevant
===ENDFILE===

===FILE: carry_forward.md===
# CARRY FORWARD - Initial Bootstrap

## Current State
- short factual assessment

## Watch Out For
- fragile or unclear areas supported by evidence

## Suggested First Tasks
- only high-value next steps supported by the codebase

## Open Questions
- uncertainties or missing ownership the next agent should inspect
===ENDFILE===`;
  }

  private organizeBootstrapFiles(files: FileInfo[]): {
    signals: BootstrapRepoSignals;
    summary: Array<{ label: string; value: string }>;
    manifests: PromptFileEntry[];
    entrypoints: PromptFileEntry[];
    architecture: PromptFileEntry[];
    runtime: PromptFileEntry[];
    docs: PromptFileEntry[];
  } {
    const signals = this.detectBootstrapRepoSignals(files);
    const caps = this.getBucketCaps(signals);
    const entries = files.map((file) => ({
      ...file,
      priority: this.getFilePriority(file.relativePath, file.content, signals),
      bucket: this.getPromptBucket(file.relativePath, file.content, signals),
      reason: this.getPromptReason(file.relativePath, file.content, signals),
      snippet: this.extractEvidenceSnippet(file.relativePath, file.content, signals),
    }));

    const sortEntries = (items: typeof entries) => items.sort((a, b) => b.priority - a.priority || a.relativePath.localeCompare(b.relativePath));
    const manifests = sortEntries(entries.filter((entry) => entry.bucket === 'manifests')).slice(0, caps.manifests).map(this.toPromptEntry);
    const entrypoints = sortEntries(entries.filter((entry) => entry.bucket === 'entrypoints')).slice(0, caps.entrypoints).map(this.toPromptEntry);
    const architecture = sortEntries(entries.filter((entry) => entry.bucket === 'architecture')).slice(0, caps.architecture).map(this.toPromptEntry);
    const runtime = sortEntries(entries.filter((entry) => entry.bucket === 'runtime')).slice(0, caps.runtime).map(this.toPromptEntry);
    const docs = sortEntries(entries.filter((entry) => entry.bucket === 'docs')).slice(0, caps.docs).map(this.toPromptEntry);

    return {
      signals,
      summary: [
        { label: 'selected files', value: String(files.length) },
        { label: 'manifests/config', value: String(manifests.length) },
        { label: 'entrypoints', value: String(entrypoints.length) },
        { label: 'architecture signals', value: String(architecture.length) },
        { label: 'runtime source', value: String(runtime.length) },
        { label: 'docs', value: String(docs.length) },
      ],
      manifests,
      entrypoints,
      architecture,
      runtime,
      docs,
    };
  }

  private toPromptEntry(entry: { relativePath: string; bucket: BootstrapPromptBucket; priority: number; reason: string; snippet: string }): PromptFileEntry {
    return entry;
  }

  private formatRepoProfile(signals: BootstrapRepoSignals): string {
    const active = Object.entries(signals)
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([profile, score]) => `${profile}(${score})`)
      .join(', ');

    return [
      '## Repo Profile',
      `- python: ${signals.python > 0 ? 'yes' : 'no'}`,
      `- script-heavy: ${signals['script-heavy'] > 0 ? 'yes' : 'no'}`,
      `- electron-frontend: ${signals['electron-frontend'] > 0 ? 'yes' : 'no'}`,
      `- library-package: ${signals['library-package'] > 0 ? 'yes' : 'no'}`,
      `- likely: ${active || 'none'}`,
    ].join('\n');
  }

  private formatRepoSummary(selected: {
    summary: Array<{ label: string; value: string }>;
  }): string {
    const lines = selected.summary.map((item) => `- ${item.label}: ${item.value}`);
    return ['## Repo Summary', ...lines].join('\n');
  }

  private formatPromptBucket(title: string, entries: PromptFileEntry[]): string {
    if (entries.length === 0) {
      return '';
    }

    return [
      `## ${title}`,
      ...entries.map((entry) => [
        `### ${entry.relativePath}`,
        `- signal: ${entry.reason}`,
        '```txt',
        entry.snippet,
        '```',
      ].join('\n')),
    ].join('\n\n');
  }

  private getPromptBucket(relativePath: string, content: string, signals: BootstrapRepoSignals): BootstrapPromptBucket {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);

    if (baseName === 'package.json' ||
      ['pyproject.toml', 'requirements.txt', 'setup.py', 'pipfile', 'poetry.lock'].includes(baseName) ||
      /^tsconfig(\..*)?\.json$/.test(baseName) ||
      /^vite\.config\.(ts|js|mts|cts|mjs|cjs)$/.test(baseName) ||
      baseName === 'electron-builder.json' ||
      baseName === 'postcss.config.js' ||
      baseName === 'tailwind.config.js') {
      return 'manifests';
    }

    if (this.isEntrypointPath(relativePath) || this.isSignalWeightedEntryPoint(relativePath, content, signals)) {
      return 'entrypoints';
    }

    if (this.isArchitectureSignal(relativePath, content, signals)) {
      return 'architecture';
    }

    if (this.isSelectedDoc(relativePath)) {
      return 'docs';
    }

    return 'runtime';
  }

  private getPromptReason(relativePath: string, content: string, signals: BootstrapRepoSignals): string {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);

    if (baseName === 'package.json') return 'package manifest and scripts';
    if (baseName === 'readme.md' && !lower.includes('/')) return 'project documentation';
    if (['pyproject.toml', 'requirements.txt', 'setup.py', 'pipfile', 'poetry.lock'].includes(baseName)) return 'python project manifest';
    if (/^tsconfig(\..*)?\.json$/.test(baseName)) return 'TypeScript configuration';
    if (/^vite\.config\.(ts|js|mts|cts|mjs|cjs)$/.test(baseName)) return 'Vite configuration';
    if (baseName === 'electron-builder.json' || baseName === 'postcss.config.js' || baseName === 'tailwind.config.js') return 'runtime build configuration';
    if (this.isEntrypointPath(relativePath) || this.isSignalWeightedEntryPoint(relativePath, content, signals)) return 'entrypoint';
    if (/ipcMain\.handle\(/.test(content) || /ipcRenderer\.invoke\(/.test(content) || /contextBridge\.exposeInMainWorld/.test(content)) return 'IPC signal';
    if (this.isArchitectureSignal(relativePath, content, signals)) return 'architecture signal';
    if (this.isSelectedDoc(relativePath)) return 'documentation';
    return 'runtime source';
  }

  private isEntrypointPath(relativePath: string): boolean {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);
    return lower.includes('/main/') ||
      lower.includes('/renderer/') ||
      lower.includes('/preload/') ||
      lower.includes('/src/index') ||
      lower.includes('/src/main') ||
      lower.includes('/src/renderer') ||
      lower.endsWith('app.tsx') ||
      lower.endsWith('main.tsx') ||
      lower.endsWith('renderer.tsx') ||
      lower.endsWith('router.tsx') ||
      baseName === 'main.ts' ||
      baseName === 'main.js' ||
      baseName === 'preload.ts' ||
      baseName === 'preload.js' ||
      baseName === 'index.ts' ||
      baseName === 'index.tsx';
  }

  private isSignalWeightedEntryPoint(relativePath: string, content: string, signals: BootstrapRepoSignals): boolean {
    if (signals.python > 0 && (/^(main|app|cli|server)\.py$/.test(path.basename(relativePath).toLowerCase()) || /if\s+__name__\s*==\s*['"]__main__['"]/.test(content))) {
      return true;
    }

    if (signals['script-heavy'] > 0 && (this.isShellOrRunnerFile(relativePath, content) || this.isBinOrCLIFile(relativePath))) {
      return true;
    }

    if (signals['electron-frontend'] > 0 && (this.isElectronPath(relativePath) || /ipcMain\.handle\(|ipcRenderer\.invoke\(|contextBridge\.exposeInMainWorld/.test(content))) {
      return true;
    }

    if (signals['library-package'] > 0 && this.isLibraryStylePath(relativePath)) {
      return true;
    }

    return false;
  }

  private isSelectedDoc(relativePath: string): boolean {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);
    const segments = lower.split('/').filter(Boolean);
    const isRootReadme = baseName === 'readme.md' && segments.length === 1;
    const isCentralDoc = segments.length <= 2 && ['overview.md', 'architecture.md', 'guide.md', 'quickstart.md', 'getting-started.md'].includes(baseName);
    return isRootReadme || isCentralDoc;
  }

  private isArchitectureSignal(relativePath: string, content: string, signals: BootstrapRepoSignals): boolean {
    const lower = relativePath.toLowerCase();
    return lower.includes('/ipc/') ||
      lower.includes('/routes/') ||
      lower.includes('/router/') ||
      lower.includes('/stores/') ||
      lower.includes('/services/') ||
      /ipcMain\.handle\(|ipcRenderer\.invoke\(|contextBridge\.exposeInMainWorld/.test(content) ||
      /<Route[^>]*path=|\bpath:\s*["'][^"']+["']|\bto:\s*["'][^"']+["']/.test(content) ||
      /zustand|create\(|set[A-Z][A-Za-z0-9_]+/i.test(content) ||
      /export\s+default\s+/.test(content) ||
      (signals['electron-frontend'] > 0 && (lower.includes('/main/') || lower.includes('/renderer/') || lower.includes('/preload/')));
  }

  private extractEvidenceSnippet(relativePath: string, content: string, signals: BootstrapRepoSignals): string {
    const lines = content.split('\n');
    const anchors = this.getSnippetAnchors(relativePath, content, signals);

    if (anchors.length > 0) {
      const index = lines.findIndex((line) => anchors[0].test(line));
      if (index >= 0) {
        return this.sliceSnippet(lines, index);
      }
    }

    return '';
  }

  private getSnippetAnchors(relativePath: string, content: string, signals: BootstrapRepoSignals): RegExp[] {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);
    const anchors: RegExp[] = [];

    if (baseName === 'package.json') {
      anchors.push(/"scripts"\s*:/, /"exports"\s*:/, /"main"\s*:/, /"module"\s*:/, /"types"\s*:/, /"bin"\s*:/);
    } else if (baseName === 'readme.md') {
      anchors.push(/^#\s+/);
    } else if (['pyproject.toml', 'requirements.txt', 'setup.py', 'pipfile', 'poetry.lock'].includes(baseName)) {
      anchors.push(/^\s*\[project\]/);
    } else if (/^tsconfig(\..*)?\.json$/.test(baseName)) {
      anchors.push(/"compilerOptions"\s*:/);
    } else if (/^vite\.config\.(ts|js|mts|cts|mjs|cjs)$/.test(baseName)) {
      anchors.push(/defineConfig/);
    } else if (baseName === 'electron-builder.json') {
      anchors.push(/"appId"\s*:/);
    } else if (baseName === 'postcss.config.js' || baseName === 'tailwind.config.js') {
      anchors.push(/module\.exports|export default/);
    } else if (/ipcMain\.handle\(|ipcRenderer\.invoke\(|contextBridge\.exposeInMainWorld/.test(content)) {
      anchors.push(/ipcMain\.handle\(/);
    } else if (lower.includes('/routes/') || lower.includes('/router/') || /<Route[^>]*path=|\bpath:\s*["'][^"']+["']/.test(content)) {
      anchors.push(/<Route[^>]*path=/);
    } else if (lower.includes('/stores/') || /zustand|create\(|set[A-Z][A-Za-z0-9_]+/i.test(content)) {
      anchors.push(/zustand/i);
    } else if (lower.includes('/main/') || lower.includes('/renderer/') || lower.includes('/preload/') || lower.endsWith('app.tsx') || lower.endsWith('main.tsx') || lower.endsWith('renderer.tsx') || lower.endsWith('router.tsx')) {
      anchors.push(/export\s+default\s+/);
    } else if (signals['library-package'] > 0 && this.isLibraryStylePath(relativePath)) {
      anchors.push(/export\s+(const|function|class)\s+/);
    } else if (signals.python > 0 && (lower.endsWith('.py') || baseName === 'setup.py' || baseName === 'pyproject.toml')) {
      anchors.push(/^if\s+__name__\s*==\s*['"]__main__['"]:/);
    } else if (signals['script-heavy'] > 0 && (this.isShellOrRunnerFile(relativePath, content) || this.isBinOrCLIFile(relativePath))) {
      anchors.push(/^#!\s*/);
    } else {
      anchors.push(/export\s+default\s+/);
    }

    return anchors;
  }

  private sliceSnippet(lines: string[], startIndex: number): string {
    const start = Math.max(0, startIndex - 1);
    const end = Math.min(lines.length, startIndex + 5);
    return lines.slice(start, end).join('\n').trim();
  }

  private detectBootstrapRepoSignals(files: FileInfo[]): BootstrapRepoSignals {
    const signals: BootstrapRepoSignals = {
      python: 0,
      'script-heavy': 0,
      'electron-frontend': 0,
      'library-package': 0,
    };

    for (const file of files) {
      const lower = file.relativePath.toLowerCase();
      const baseName = path.basename(lower);

      if (['pyproject.toml', 'requirements.txt', 'setup.py', 'pipfile', 'poetry.lock'].includes(baseName) || lower.endsWith('.py') || /(?:def|class)\s+[A-Za-z_]/.test(file.content) || /if\s+__name__\s*==\s*['"]__main__['"]/.test(file.content)) {
        signals.python += 1;
      }

      if (/package\.json$/.test(baseName) || this.isEntrypointPath(file.relativePath) || this.isScriptHeavyPath(file.relativePath, file.content)) {
        signals['script-heavy'] += 1;
      }

      if (/electron/i.test(file.content) || this.isElectronPath(file.relativePath) || /ipcMain\.handle\(|ipcRenderer\.invoke\(|contextBridge\.exposeInMainWorld/.test(file.content)) {
        signals['electron-frontend'] += 1;
      }

      if (baseName === 'package.json' || this.isLibraryStylePath(file.relativePath) || /export\s+/.test(file.content)) {
        signals['library-package'] += 1;
      }
    }

    return signals;
  }

  private getBucketCaps(signals: BootstrapRepoSignals): {
    manifests: number;
    entrypoints: number;
    architecture: number;
    runtime: number;
    docs: number;
  } {
    return {
      manifests: 8,
      entrypoints: 8,
      architecture: 8,
      runtime: 8,
      docs: 2,
    };
  }

  private isScriptHeavyPath(relativePath: string, content: string): boolean {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);
    return lower.includes('/scripts/') ||
      lower.includes('/script/') ||
      lower.includes('/tools/') ||
      lower.includes('/tooling/') ||
      lower.includes('/cli/') ||
      lower.includes('/bin/') ||
      /^(makefile|gnumakefile)$/i.test(baseName) ||
      /\.(sh|bash|zsh|ps1|cmd|bat)$/.test(baseName) ||
      /(?:build|start|dev|run|package|bootstrap|setup)/i.test(content);
  }

  private isShellOrRunnerFile(relativePath: string, content: string): boolean {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);
    return /\.(sh|bash|zsh|ps1|cmd|bat)$/.test(baseName) ||
      /^(makefile|gnumakefile)$/i.test(baseName) ||
      /^#!\s*/.test(content) ||
      (this.isScriptHeavyPath(relativePath, content) && /(?:build|start|dev|run|package|bootstrap|setup)/i.test(content));
  }

  private isBinOrCLIFile(relativePath: string): boolean {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);
    return lower.includes('/bin/') ||
      lower.includes('/cli/') ||
      baseName === 'cli.ts' ||
      baseName === 'cli.js' ||
      baseName === 'main.py' ||
      baseName === 'main.ts' ||
      baseName === 'main.js';
  }

  private isElectronPath(relativePath: string): boolean {
    const lower = relativePath.toLowerCase();
    return lower.includes('/main/') || lower.includes('/renderer/') || lower.includes('/preload/') || lower.includes('/ipc/') || lower.includes('/routes/') || lower.includes('/router/') || lower.includes('/stores/');
  }

  private isLibraryStylePath(relativePath: string): boolean {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);
    return lower === 'index.ts' ||
      lower === 'index.js' ||
      lower === 'src/index.ts' ||
      lower === 'src/index.js' ||
      baseName === 'index.tsx' ||
      baseName === 'index.mts' ||
      baseName === 'index.cts' ||
      baseName === 'mod.ts' ||
      lower.includes('/exports/') ||
      lower.includes('/public/');
  }

  private async writeMarkdownAbsolute(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }
}



