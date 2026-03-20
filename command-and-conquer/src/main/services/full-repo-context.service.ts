import * as fs from 'fs/promises';
import { Dirent } from 'fs';
import * as path from 'path';
import { FileStore } from '../storage/file-store';
import { ProjectService } from './project.service';
import { Repository, Project } from '../types';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__',
]);

const INCLUDE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.mts', '.cts', '.yaml', '.yml', '.toml',
  '.py', '.go', '.rs', '.java', '.cs', '.rb', '.php', '.vue', '.svelte', '.kt', '.swift', '.dart',
  '.sh', '.ps1', '.log', '.txt', '.bak', '.old', '.backup', '.orig', '.copy',
]);

const INCLUDE_NAMES = new Set([
  'package.json', 'README.md', 'tsconfig.json', 'tsconfig.main.json', 'tsconfig.renderer.json',
  'vite.config.ts', 'vite.config.js', 'electron-builder.json', '.eslintrc.json', '.eslintrc.js',
  'postcss.config.js', 'tailwind.config.js',
]);

const SKIP_FILES = new Set(['package-lock.json', 'yarn.lock']);

type FileKind =
  | 'component'
  | 'hook'
  | 'service'
  | 'store'
  | 'config'
  | 'entry'
  | 'route'
  | 'util'
  | 'doc'
  | 'unknown';

type RepoContextCategory =
  | 'core-app'
  | 'tooling'
  | 'test'
  | 'log-artifact'
  | 'archive-old'
  | 'prompt-doc'
  | 'workspace-meta'
  | 'unknown';

type RepoProfileName = 'python' | 'script-heavy' | 'electron-frontend' | 'library-package';

interface ScannerConfig {
  skipDirs: string[];
  includeExtensions: string[];
  includeNames: string[];
  skipFiles: string[];
}

interface FileWalkStats {
  totalFiles: number;
  totalDirectories: number;
  includedFiles: number;
  skippedFiles: number;
  skippedDirectories: number;
}

interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  size: number;
  content: string;
  kind: FileKind;
  contextCategory: RepoContextCategory;
  matchedProfiles: RepoProfileName[];
  includeInPrimaryContext: boolean;
  excludeReason: string | null;
  classificationReason: string;
  classificationBasis: string;
  isAmbiguous: boolean;
  imports: string[];
  exports: string[];
  importanceScore: number;
  hasJsx: boolean;
  routeHints: string[];
  ipcHints: string[];
  storeHints: string[];
  docTitle?: string;
}

interface RepoFileMetadata {
  relativePath: string;
  kind: FileKind;
  contextCategory: RepoContextCategory;
  matchedProfiles: RepoProfileName[];
  includeInPrimaryContext: boolean;
  excludeReason: string | null;
  classificationBasis: string;
  imports: string[];
  exports: string[];
  size: number;
  importanceScore: number;
}

interface PackageInfo {
  name: string | null;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  exports: unknown;
  main: string | null;
  module: string | null;
  types: string | null;
  bin: Record<string, string> | string | null;
  files: string[];
  packageType: string | null;
}

interface PythonProjectInfo {
  manifestFiles: string[];
  hasPyproject: boolean;
  pyprojectName: string | null;
  pyprojectDependencyCount: number;
  hasRequirements: boolean;
  requirementsCount: number;
  hasSetupPy: boolean;
  setupName: string | null;
  hasPipfile: boolean;
  pipfilePackageCount: number;
  hasPoetryLock: boolean;
  poetryPackageCount: number;
  frameworkHints: string[];
}

interface RepoContextSnapshot {
  schemaVersion: number;
  repoRoot: string;
  selectedRepoRoot: string;
  scanRoot: string;
  classificationPolicy: string;
  projectId: string;
  projectName: string;
  selectedRepoId: string;
  selectedRepo: Repository;
  generatedAt: string;
  profileScores: Record<RepoProfileName, number>;
  activeProfiles: RepoProfileName[];
  pythonProjectInfo: PythonProjectInfo;
  scannerConfig: ScannerConfig;
  summaryCounts: {
    totalFiles: number;
    totalDirectories: number;
    includedFiles: number;
    primaryFiles: number;
    excludedFiles: number;
    skippedFiles: number;
    skippedDirectories: number;
    fileTypeCounts: Record<string, number>;
    classificationCounts: Record<RepoContextCategory, number>;
    likelyStackFrameworkClues: string[];
  };
  packageInfo: PackageInfo;
  primaryContextFiles: RepoFileMetadata[];
  excludedFiles: Array<RepoFileMetadata & { excludeReason: string }>;
  ambiguousFilesReviewed: Array<{
    relativePath: string;
    contextCategory: RepoContextCategory;
    reason: string;
    classificationBasis: string;
  }>;
  suppressionSummary: {
    primaryFiles: number;
    excludedFiles: number;
    classificationCounts: Record<RepoContextCategory, number>;
    suppressedByCategory: Partial<Record<RepoContextCategory, number>>;
    suppressedReasons: Array<{ reason: string; count: number }>;
  };
  keyDirectories: Array<{ path: string; fileCount: number }>;
  keyFiles: Array<{ relativePath: string; kind: FileKind; importanceScore: number }>;
  likelyEntryPoints: Array<{ relativePath: string; reason: string; importanceScore: number }>;
  routes: Array<{ route: string; sourceFile: string; pattern: string }>;
  ipc: {
    mainHandlers: string[];
    rendererCalls: string[];
    preloadExposedApis: string[];
  };
  stateManagement: {
    stores: Array<{
      file: string;
      storeName: string;
      actions: string[];
      evidence: string[];
    }>;
  };
  moduleList: RepoFileMetadata[]; 
  docsDiscovered: Array<{ relativePath: string; title: string; importanceScore: number }>;
  openQuestions: string[];
}

export class FullRepoContextService {
  constructor(
    private projectService: ProjectService,
    private fileStore: FileStore,
  ) {}

  async buildFullRepoContext(projectId: string): Promise<{ outputPath: string; snapshot: RepoContextSnapshot }> {
    const { project, repo } = await this.resolveSelectedRepository(projectId);
    const selectedRepoRoot = repo.localPath.trim();

    try {
      await fs.access(selectedRepoRoot);
    } catch {
      throw new Error(`Selected repository path is inaccessible: ${selectedRepoRoot}`);
    }

    const scanRoot = await fs.realpath(selectedRepoRoot);
    const packageInfo = await this.readPackageInfo(scanRoot);
    const pythonProjectInfo = await this.readPythonProjectInfo(scanRoot);
    const generatedAt = new Date().toISOString();
    const analysis = await this.scanRepository(scanRoot, packageInfo);
    const profileScores = this.computeProfileScores(packageInfo, analysis.modules, pythonProjectInfo);
    const activeProfiles = this.pickActiveProfiles(profileScores);
    this.rebalanceProfileImportance(analysis.modules, profileScores, activeProfiles);
    const clues = this.buildFrameworkClues(packageInfo, analysis.primaryModules, pythonProjectInfo);

    const snapshot: RepoContextSnapshot = {
      schemaVersion: 3,
      repoRoot: selectedRepoRoot,
      selectedRepoRoot,
      scanRoot,
      classificationPolicy: 'repo-profile-v1',
      projectId,
      projectName: project.name,
      selectedRepoId: repo.id,
      selectedRepo: repo,
      generatedAt,
      profileScores,
      activeProfiles,
      pythonProjectInfo,
      scannerConfig: this.getScannerConfig(),
      summaryCounts: {
        totalFiles: analysis.stats.totalFiles,
        totalDirectories: analysis.stats.totalDirectories,
        includedFiles: analysis.primaryModules.length,
        primaryFiles: analysis.primaryModules.length,
        excludedFiles: analysis.excludedModules.length,
        skippedFiles: analysis.stats.skippedFiles,
        skippedDirectories: analysis.stats.skippedDirectories,
        fileTypeCounts: this.countByKind(analysis.primaryModules),
        classificationCounts: this.countByClassification(analysis.modules),
        likelyStackFrameworkClues: clues,
      },
      packageInfo,
      primaryContextFiles: analysis.primaryModules.map((module) => this.toModuleMetadata(module)),
      excludedFiles: analysis.excludedModules.map((module) => ({
        ...this.toModuleMetadata(module),
        excludeReason: module.excludeReason || 'excluded-by-classification',
      })),
      ambiguousFilesReviewed: analysis.ambiguousFiles.map((module) => ({
        relativePath: module.relativePath,
        contextCategory: module.contextCategory,
        reason: module.classificationReason,
        classificationBasis: module.classificationBasis,
      })),
      suppressionSummary: analysis.suppressionSummary,
      keyDirectories: this.pickKeyDirectories(analysis.primaryModules, activeProfiles),
      keyFiles: this.pickKeyFiles(analysis.primaryModules),
      likelyEntryPoints: this.pickEntryPoints(analysis.primaryModules, activeProfiles),
      routes: analysis.routes,
      ipc: {
        mainHandlers: analysis.ipc.mainHandlers,
        rendererCalls: analysis.ipc.rendererCalls,
        preloadExposedApis: analysis.ipc.preloadExposedApis,
      },
      stateManagement: {
        stores: analysis.stores,
      },
      moduleList: this.orderModulesForReview(analysis.modules).map((module) => this.toModuleMetadata(module)),
      docsDiscovered: analysis.docs,
      openQuestions: this.buildOpenQuestions(packageInfo, analysis),
    };

    const workspaceOutputPath = `workspace/projects/${projectId}/knowledge/repo-context/FULL_REPO_CONTEXT.json`;
    const repoOutputPath = path.join(selectedRepoRoot, 'knowledge', 'repo-context', 'FULL_REPO_CONTEXT.json');

    await Promise.all([
      this.fileStore.writeJSON(workspaceOutputPath, snapshot),
      this.writeJsonAbsolute(repoOutputPath, snapshot),
    ]);

    return { outputPath: repoOutputPath, snapshot };
  }

  private async resolveSelectedRepository(projectId: string): Promise<{ project: Project; repo: Repository }> {
    const project = await this.projectService.getProject(projectId);
    if (!project) {
      throw new Error(`Active project not found: ${projectId}`);
    }

    if (!project.activeRepoId) {
      throw new Error(`No selected repository is set for project ${projectId}`);
    }

    const repos = await this.projectService.listRepos(projectId);
    const repo = repos.find((candidate) => candidate.id === project.activeRepoId);
    if (!repo) {
      throw new Error(`Selected repository ${project.activeRepoId} was not found for project ${projectId}`);
    }

    if (!repo.localPath || !repo.localPath.trim()) {
      throw new Error(`Selected repository path is missing for repo ${repo.id}`);
    }

    return { project, repo };
  }

  private getScannerConfig(): ScannerConfig {
    return {
      skipDirs: [...SKIP_DIRS].sort(),
      includeExtensions: [...INCLUDE_EXTENSIONS].sort(),
      includeNames: [...INCLUDE_NAMES].sort(),
      skipFiles: [...SKIP_FILES].sort(),
    };
  }

  private async scanRepository(repoRoot: string, packageInfo: PackageInfo): Promise<{
    stats: FileWalkStats;
    modules: ScannedFile[];
    primaryModules: ScannedFile[];
    excludedModules: ScannedFile[];
    ambiguousFiles: ScannedFile[];
    routes: Array<{ route: string; sourceFile: string; pattern: string }>;
    ipc: {
      mainHandlers: string[];
      rendererCalls: string[];
      preloadExposedApis: string[];
    };
    stores: Array<{ file: string; storeName: string; actions: string[]; evidence: string[] }>;
    docs: Array<{ relativePath: string; title: string; importanceScore: number }>;
    suppressionSummary: RepoContextSnapshot['suppressionSummary'];
  }> {
    const stats: FileWalkStats = {
      totalFiles: 0,
      totalDirectories: 1,
      includedFiles: 0,
      skippedFiles: 0,
      skippedDirectories: 0,
    };

    const files = await this.walkRepository(repoRoot, stats);
    const modules: ScannedFile[] = [];
    for (const filePath of files) {
      const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
      const content = await fs.readFile(filePath, 'utf8');
      const size = Buffer.byteLength(content, 'utf8');
      const imports = this.extractImports(content);
      const exports = this.extractExports(content);
      const hasJsx = /<[A-Za-z][\w:-]*(\s|>|\/)/.test(content);
      const routeHints = this.extractRouteHints(content);
      const ipcHints = this.extractIpcHints(content);
      const storeHints = this.extractStoreHints(content);
      const kind = this.classifyFile(relativePath, content, hasJsx, routeHints, storeHints);
      const docTitle = this.extractDocTitle(content, relativePath);
      const classification = this.classifyRepoContext(
        relativePath,
        content,
        hasJsx,
        routeHints,
        storeHints,
      );
      const matchedProfiles = this.detectMatchedProfiles(relativePath, content, hasJsx, routeHints, storeHints, imports, exports, kind, classification, packageInfo);
      const importanceScore = this.scoreFile(
        relativePath,
        kind,
        content,
        imports,
        exports,
        routeHints,
        ipcHints,
        storeHints,
        classification.includeInPrimaryContext,
      );

      modules.push({
        absolutePath: filePath,
        relativePath,
        size,
        content,
        kind,
        contextCategory: classification.category,
        matchedProfiles,
        includeInPrimaryContext: classification.includeInPrimaryContext,
        excludeReason: classification.excludeReason,
        classificationReason: classification.reason,
        classificationBasis: classification.basis,
        isAmbiguous: classification.isAmbiguous,
        imports,
        exports,
        importanceScore,
        hasJsx,
        routeHints,
        ipcHints,
        storeHints,
        docTitle,
      });
    }

    this.resolvePrimaryTooling(modules, packageInfo);

    const primaryModules = modules.filter((module) => module.includeInPrimaryContext);
    const excludedModules = modules.filter((module) => !module.includeInPrimaryContext);
    const ambiguousFiles = modules.filter((module) => module.isAmbiguous);

    modules.sort((a, b) => {
      if (a.includeInPrimaryContext !== b.includeInPrimaryContext) {
        return a.includeInPrimaryContext ? -1 : 1;
      }
      return b.importanceScore - a.importanceScore || a.relativePath.localeCompare(b.relativePath);
    });
    const primarySignals = this.collectPrimarySignals(primaryModules);

    stats.includedFiles = primaryModules.length;
    const suppressionSummary = this.buildSuppressionSummary(primaryModules, excludedModules);

    return {
      stats,
      modules,
      primaryModules,
      excludedModules,
      ambiguousFiles,
      routes: primarySignals.routes,
      ipc: primarySignals.ipc,
      stores: primarySignals.stores,
      docs: primarySignals.docs,
      suppressionSummary,
    };
  }

  private async walkRepository(repoRoot: string, stats: FileWalkStats): Promise<string[]> {
    const files: string[] = [];
    const stack: string[] = [repoRoot];

    while (stack.length > 0) {
      const currentDir = stack.pop();
      if (!currentDir) {
        continue;
      }

      let entries: Dirent[];
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch {
        continue;
      }

      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isSymbolicLink()) {
          stats.skippedFiles += 1;
          continue;
        }

        const normalizedPath = path.resolve(fullPath);
        if (!this.isInsideRoot(repoRoot, normalizedPath)) {
          if (entry.isDirectory()) {
            stats.skippedDirectories += 1;
          } else {
            stats.skippedFiles += 1;
          }
          continue;
        }

        if (entry.isDirectory()) {
          stats.totalDirectories += 1;
          if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.git')) {
            stats.skippedDirectories += 1;
            continue;
          }
          stack.push(fullPath);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        stats.totalFiles += 1;
        if (this.shouldIncludeFile(entry.name)) {
          files.push(fullPath);
        } else {
          stats.skippedFiles += 1;
        }
      }
    }

    return files.sort((a, b) => a.localeCompare(b));
  }

  private shouldIncludeFile(filename: string): boolean {
    if (SKIP_FILES.has(filename)) {
      return false;
    }

    if (INCLUDE_NAMES.has(filename)) {
      return true;
    }

    const ext = path.extname(filename).toLowerCase();
    return INCLUDE_EXTENSIONS.has(ext);
  }

  private extractImports(content: string): string[] {
    const results = new Set<string>();
    const importRegex = /import\s+(?:type\s+)?(?:[\w*\s{},]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      results.add(match[1]);
    }
    return [...results].sort();
  }

  private extractExports(content: string): string[] {
    const results = new Set<string>();
    const namedRegex = /export\s+(?:declare\s+)?(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+([A-Za-z0-9_]+)/g;
    let match: RegExpExecArray | null;
    while ((match = namedRegex.exec(content)) !== null) {
      results.add(match[1]);
    }

    const braceRegex = /export\s*{\s*([^}]+)\s*}/g;
    while ((match = braceRegex.exec(content)) !== null) {
      const names = match[1].split(',').map((part) => part.trim()).filter(Boolean);
      for (const name of names) {
        results.add(name.replace(/\s+as\s+.*/, ''));
      }
    }

    if (/export\s+default\s+/g.test(content)) {
      results.add('default');
    }

    return [...results].sort();
  }

  private extractRouteHints(content: string): string[] {
    const routes = new Set<string>();
    const routeRegexes = [
      /<Route[^>]*path=["']([^"']+)["']/g,
      /\bpath:\s*["']([^"']+)["']/g,
      /\bto:\s*["']([^"']+)["']/g,
    ];

    for (const regex of routeRegexes) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        routes.add(match[1]);
      }
    }

    return [...routes].sort();
  }

  private extractIpcHints(content: string): string[] {
    const hints = new Set<string>();

    for (const handler of this.extractMainIpcHandlers(content)) {
      hints.add(`main:${handler}`);
    }
    for (const call of this.extractRendererCalls(content)) {
      hints.add(`renderer:${call}`);
    }
    for (const api of this.extractPreloadApis(content)) {
      hints.add(`preload:${api}`);
    }

    return [...hints].sort();
  }

  private extractMainIpcHandlers(content: string): string[] {
    const results = new Set<string>();
    const regex = /ipcMain\.handle\(\s*['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      results.add(match[1]);
    }
    return [...results].sort();
  }

  private extractRendererCalls(content: string): string[] {
    const results = new Set<string>();
    const regex = /ipcRenderer\.invoke\(\s*['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      results.add(match[1]);
    }
    return [...results].sort();
  }

  private extractPreloadApis(content: string): string[] {
    const results = new Set<string>();
    const startToken = "contextBridge.exposeInMainWorld('api',";
    const startIndex = content.indexOf(startToken);
    if (startIndex === -1) {
      return [];
    }

    const firstBrace = content.indexOf('{', startIndex);
    if (firstBrace === -1) {
      return [];
    }

    let depth = 0;
    let endIndex = -1;
    for (let index = firstBrace; index < content.length; index += 1) {
      const char = content[index];
      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          endIndex = index;
          break;
        }
      }
    }

    if (endIndex === -1) {
      return [];
    }

    const block = content.slice(firstBrace + 1, endIndex);
    const lines = block.split('\n');
    const stack: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      const sectionMatch = line.match(/^([A-Za-z0-9_]+):\s*{$/);
      if (sectionMatch) {
        stack.push(sectionMatch[1]);
        continue;
      }

      if (line === '},' || line === '}') {
        stack.pop();
        continue;
      }

      const methodMatch = line.match(/^([A-Za-z0-9_]+):\s*\(/);
      if (methodMatch && stack.length > 0) {
        results.add(`${stack[stack.length - 1]}.${methodMatch[1]}`);
      }
    }

    return [...results].sort();
  }

  private extractStoreHints(content: string): string[] {
    const hints = new Set<string>();
    if (/zustand/i.test(content)) hints.add('zustand');
    if (/create\s*<.*>\s*\(/.test(content) || /create\(/.test(content)) hints.add('create-store');
    if (/set[A-Z][A-Za-z0-9_]+/.test(content)) hints.add('actions');
    return [...hints].sort();
  }

  private extractStoreName(relativePath: string, content: string): string {
    const basename = path.basename(relativePath, path.extname(relativePath));
    const exportMatch = content.match(/export\s+const\s+([A-Za-z0-9_]+)/);
    return exportMatch?.[1] || basename;
  }

  private extractStoreActions(content: string): string[] {
    const actions = new Set<string>();
    const actionRegex = /^\s*([A-Za-z0-9_]+):\s*(?:\(|async\s*\(|\w+\s*=>)/gm;
    let match: RegExpExecArray | null;
    while ((match = actionRegex.exec(content)) !== null) {
      actions.add(match[1]);
    }
    return [...actions].sort();
  }

  private classifyFile(
    relativePath: string,
    content: string,
    hasJsx: boolean,
    routeHints: string[],
    storeHints: string[],
  ): FileKind {
    const lowerPath = relativePath.toLowerCase();
    const baseName = path.basename(relativePath).toLowerCase();

    if (lowerPath.endsWith('.md')) return 'doc';
    if (this.isPythonEntryPoint(relativePath)) return 'entry';
    if (this.isPythonConfig(relativePath)) return 'config';
    if (lowerPath.endsWith('.py')) {
      if (this.isScriptOrToolPath(relativePath)) {
        return 'util';
      }
      if (this.containsPythonFrameworkClue(content) || /(?:def|class)\s+[A-Za-z_]/.test(content) || /if\s+__name__\s*==\s*['"]__main__['"]/.test(content)) {
        return 'service';
      }
      return 'service';
    }
    if (INCLUDE_NAMES.has(path.basename(relativePath))) return 'config';
    if (lowerPath.includes('/stores/') || lowerPath.endsWith('.store.ts') || lowerPath.endsWith('.store.tsx') || storeHints.length > 0) {
      return 'store';
    }
    if (lowerPath.includes('/hooks/') || /^use[A-Z]/.test(path.basename(relativePath))) return 'hook';
    if (lowerPath.includes('/services/')) return 'service';
    if (routeHints.length > 0) return 'route';
    if (lowerPath.includes('/components/') || lowerPath.includes('/pages/') || hasJsx) return 'component';
    if (lowerPath.includes('/main/') || baseName === 'index.ts' || baseName === 'index.tsx' || baseName === 'main.ts' || baseName === 'main.tsx' || baseName === 'preload.ts' || baseName === 'app.tsx') {
      return 'entry';
    }
    if (lowerPath.includes('/utils/') || lowerPath.includes('/lib/')) return 'util';
    if (/export\s+default\s+/.test(content) && hasJsx) return 'component';
    return 'unknown';
  }

  private scoreFile(
    relativePath: string,
    kind: FileKind,
    content: string,
    imports: string[],
    exports: string[],
    routeHints: string[],
    ipcHints: string[],
    storeHints: string[],
    includeInPrimaryContext: boolean,
  ): number {
    let score = 0;
    const lowerPath = relativePath.toLowerCase();

    if (kind === 'entry') score += 60;
    if (kind === 'config') score += 45;
    if (kind === 'service') score += 28;
    if (kind === 'store') score += 32;
    if (kind === 'hook') score += 22;
    if (kind === 'route') score += 35;
    if (kind === 'component') score += 18;
    if (kind === 'doc') score += 8;
    if (/package\.json$/.test(lowerPath)) score += 70;
    if (/app\.tsx$/.test(lowerPath) || /main\.ts$/.test(lowerPath) || /main\.tsx$/.test(lowerPath)) score += 40;
    if (lowerPath.includes('/ipc/') || ipcHints.length > 0) score += 30;
    if (routeHints.length > 0) score += 12;
    if (storeHints.length > 0) score += 10;
    if (imports.length > 0) score += Math.min(imports.length, 10);
    if (exports.length > 0) score += Math.min(exports.length, 10);
    if (/window\.api\./.test(content)) score += 15;
    if (/ipcMain\.handle\(/.test(content)) score += 20;
    if (/contextBridge\.exposeInMainWorld/.test(content)) score += 20;
    if (!includeInPrimaryContext) score = 0;

    return score;
  }

  private extractDocTitle(content: string, relativePath: string): string {
    const firstHeading = content.match(/^#\s+(.+)$/m);
    if (firstHeading) {
      return firstHeading[1].trim();
    }
    return path.basename(relativePath);
  }

  private pickKeyDirectories(modules: ScannedFile[], activeProfiles: RepoProfileName[]): Array<{ path: string; fileCount: number }> {
    const counts = new Map<string, number>();

    for (const module of modules) {
      const parts = module.relativePath.split('/');
      const weight = this.getProfileDirectoryWeight(module, activeProfiles);
      for (let index = 1; index < parts.length; index += 1) {
        const dir = parts.slice(0, index).join('/');
        counts.set(dir, (counts.get(dir) || 0) + weight);
      }
    }

    return [...counts.entries()]
      .filter(([, fileCount]) => fileCount >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([pathName, fileCount]) => ({ path: pathName, fileCount }));
  }

  private pickKeyFiles(modules: ScannedFile[]): Array<{ relativePath: string; kind: FileKind; importanceScore: number }> {
    return modules
      .slice()
      .sort((a, b) => b.importanceScore - a.importanceScore || a.relativePath.localeCompare(b.relativePath))
      .slice(0, 20)
      .map((module) => ({
        relativePath: module.relativePath,
        kind: module.kind,
        importanceScore: module.importanceScore,
      }));
  }

  private pickEntryPoints(modules: ScannedFile[], activeProfiles: RepoProfileName[]): Array<{ relativePath: string; reason: string; importanceScore: number }> {
    const results: Array<{ relativePath: string; reason: string; importanceScore: number }> = [];

    for (const module of modules) {
      const lower = module.relativePath.toLowerCase();
      const reasons: string[] = [];
      if (module.kind === 'entry') reasons.push('entry-kind');
      if (/package\.json$/.test(lower)) reasons.push('package-manifest');
      if (lower.endsWith('app.tsx')) reasons.push('app-shell');
      if (lower.endsWith('main.tsx') || lower.endsWith('main.ts')) reasons.push('react-entry');
      if (lower.endsWith('index.ts') || lower.endsWith('index.tsx')) reasons.push('main-index');
      if (module.routeHints.length > 0) reasons.push('route-definitions');
      this.appendProfileEntryPointReasons(module, activeProfiles, reasons);

      if (reasons.length > 0) {
        results.push({
          relativePath: module.relativePath,
          reason: [...new Set(reasons)].join(', '),
          importanceScore: module.importanceScore,
        });
      }
    }

    return results
      .sort((a, b) => b.importanceScore - a.importanceScore || a.relativePath.localeCompare(b.relativePath))
      .slice(0, 12);
  }

  private countByKind(modules: ScannedFile[]): Record<string, number> {
    return modules.reduce<Record<string, number>>((acc, module) => {
      acc[module.kind] = (acc[module.kind] || 0) + 1;
      return acc;
    }, {});
  }

  private countByClassification(modules: ScannedFile[]): Record<RepoContextCategory, number> {
    return modules.reduce<Record<RepoContextCategory, number>>((acc, module) => {
      acc[module.contextCategory] = (acc[module.contextCategory] || 0) + 1;
      return acc;
    }, {
      'core-app': 0,
      tooling: 0,
      test: 0,
      'log-artifact': 0,
      'archive-old': 0,
      'prompt-doc': 0,
      'workspace-meta': 0,
      unknown: 0,
    });
  }

  private computeProfileScores(packageInfo: PackageInfo, modules: ScannedFile[], pythonProjectInfo: PythonProjectInfo): Record<RepoProfileName, number> {
    const pythonScore = this.scorePythonProfile(packageInfo, modules, pythonProjectInfo);
    const scriptHeavyScore = this.scoreScriptHeavyProfile(packageInfo, modules);
    const electronFrontendScore = this.scoreElectronFrontendProfile(packageInfo, modules);
    const libraryPackageScore = this.scoreLibraryPackageProfile(packageInfo, modules);

    return {
      python: pythonScore,
      'script-heavy': scriptHeavyScore,
      'electron-frontend': electronFrontendScore,
      'library-package': libraryPackageScore,
    };
  }

  private detectMatchedProfiles(
    relativePath: string,
    content: string,
    hasJsx: boolean,
    routeHints: string[],
    storeHints: string[],
    imports: string[],
    exports: string[],
    kind: FileKind,
    classification: {
      category: RepoContextCategory;
      includeInPrimaryContext: boolean;
      excludeReason: string | null;
      reason: string;
      basis: string;
      isAmbiguous: boolean;
    },
    packageInfo: PackageInfo,
  ): RepoProfileName[] {
    const profiles = new Set<RepoProfileName>();

    if (this.isPythonFile(relativePath) || this.isPythonConfig(relativePath) || this.isPythonEntryPoint(relativePath) || /(?:def|class)\s+[A-Za-z_]/.test(content) || this.containsPythonFrameworkClue(content)) {
      profiles.add('python');
    }

    if (this.isStrongScriptHeavySignal(relativePath, content, imports, exports, kind, classification, packageInfo, routeHints, storeHints)) {
      profiles.add('script-heavy');
    }

    if (this.isStrongElectronFrontendSignal(relativePath, content, hasJsx, routeHints, storeHints, kind, classification, packageInfo)) {
      profiles.add('electron-frontend');
    }

    if (this.isLibraryPackageSignal(relativePath, content, imports, exports, kind, hasJsx, routeHints, storeHints, classification, packageInfo)) {
      profiles.add('library-package');
    }

    return [...profiles];
  }

  private pickActiveProfiles(profileScores: Record<RepoProfileName, number>): RepoProfileName[] {
    const entries = Object.entries(profileScores) as Array<[RepoProfileName, number]>;
    const sorted = entries
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .filter(([, score]) => score >= 40);

    if (sorted.length > 0) {
      return sorted.map(([profile]) => profile);
    }

    const top = entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (top && top[1] >= 25) {
      return [top[0]];
    }

    return [];
  }

  private scorePythonProfile(packageInfo: PackageInfo, modules: ScannedFile[], pythonProjectInfo: PythonProjectInfo): number {
    const frameworkSignals = modules.reduce((count, module) => count + this.extractPythonFrameworkClues(module.content).length, 0) +
      pythonProjectInfo.frameworkHints.length;
    const score = this.boundScore(
      (pythonProjectInfo.hasPyproject ? 22 : 0) +
      (pythonProjectInfo.pyprojectName ? 3 : 0) +
      (pythonProjectInfo.pyprojectDependencyCount > 0 ? Math.min(pythonProjectInfo.pyprojectDependencyCount * 2, 10) : 0) +
      (pythonProjectInfo.hasRequirements ? Math.min(pythonProjectInfo.requirementsCount * 2, 12) : 0) +
      (pythonProjectInfo.hasSetupPy ? 10 : 0) +
      (pythonProjectInfo.setupName ? 2 : 0) +
      (pythonProjectInfo.hasPipfile ? Math.max(6, pythonProjectInfo.pipfilePackageCount * 2) : 0) +
      (pythonProjectInfo.hasPoetryLock ? Math.max(5, pythonProjectInfo.poetryPackageCount) : 0) +
      this.countModules(modules, (module) => this.isPythonFile(module.relativePath)) * 5 +
      this.countModules(modules, (module) => this.isPythonEntryPoint(module.relativePath)) * 12 +
      this.countModules(modules, (module) => this.isPythonConfig(module.relativePath)) * 14 +
      this.countModules(modules, (module) => module.relativePath.endsWith('__init__.py')) * 6 +
      this.countModules(modules, (module) => ['main.py', 'app.py', 'cli.py', 'server.py', '__main__.py'].includes(path.basename(module.relativePath).toLowerCase())) * 10 +
      Math.min(frameworkSignals * 6, 24),
      100,
    );

    return score;
  }

  private scoreScriptHeavyProfile(packageInfo: PackageInfo, modules: ScannedFile[]): number {
    const scriptCount = Object.keys(packageInfo.scripts || {}).length;
    const referencedScriptModules = modules.filter((module) => module.includeInPrimaryContext && this.isStrongScriptHeavySignal(
      module.relativePath,
      module.content,
      module.imports,
      module.exports,
      module.kind,
      {
        category: module.contextCategory,
        includeInPrimaryContext: module.includeInPrimaryContext,
        excludeReason: module.excludeReason,
        reason: module.classificationReason,
        basis: module.classificationBasis,
        isAmbiguous: module.isAmbiguous,
      },
      packageInfo,
      module.routeHints,
      module.storeHints,
    ));
    const toolPathModules = modules.filter((module) => this.isScriptOrToolPath(module.relativePath));
    const shellModules = modules.filter((module) => this.isShellOrRunnerFile(module.relativePath, module.content));
    const binModules = modules.filter((module) => this.isBinOrCLIFile(module.relativePath));
    const referencedPackageScripts = this.countModules(modules, (module) => module.includeInPrimaryContext && this.findPackageScriptReference(module, packageInfo) !== null);
    const runtimeFlowModules = this.countModules(modules, (module) =>
      module.includeInPrimaryContext &&
      (
        module.kind === 'entry' ||
        module.kind === 'config' ||
        module.kind === 'service' ||
        module.kind === 'util' ||
        module.routeHints.length > 0 ||
        module.storeHints.length > 0 ||
        module.ipcHints.length > 0
      ) &&
      (this.findPackageScriptReference(module, packageInfo) !== null || this.findPrimaryFileReference(module, modules.filter((candidate) => candidate.includeInPrimaryContext)) !== null)
    );

    const score = this.boundScore(
      Math.min(scriptCount * 8, 40) +
      Math.min(referencedPackageScripts * 10, 30) +
      Math.min(referencedScriptModules.length * 8, 24) +
      Math.min(runtimeFlowModules * 6, 18) +
      Math.min(binModules.length * 4, 12) +
      Math.min(shellModules.length * 3, 12) +
      Math.min(toolPathModules.length * 1, 8) +
      (scriptCount > 0 ? 6 : 0),
      100,
    );

    return score;
  }

  private scoreElectronFrontendProfile(packageInfo: PackageInfo, modules: ScannedFile[]): number {
    const packageSignals = this.countPackageSignals([
      packageInfo.main,
      packageInfo.module,
      packageInfo.types,
      packageInfo.packageType,
    ]);
    const electronDeps = this.countDependencySignals(packageInfo, ['electron', 'react', 'react-dom', 'react-router-dom', 'vite', 'zustand', 'tailwindcss']);
    const electronCoreDeps = this.countDependencySignals(packageInfo, ['electron']);
    const reactDeps = this.countDependencySignals(packageInfo, ['react', 'react-dom']);
    const viteDeps = this.countDependencySignals(packageInfo, ['vite']);
    const mainSignals = this.countModules(modules, (module) => this.isElectronMainFile(module.relativePath));
    const rendererSignals = this.countModules(modules, (module) => this.isElectronRendererFile(module.relativePath));
    const preloadSignals = this.countModules(modules, (module) => this.isElectronPreloadFile(module.relativePath));
    const routeSignals = this.countModules(modules, (module) => module.routeHints.length > 0);
    const storeSignals = this.countModules(modules, (module) => module.storeHints.length > 0);
    const ipcSignals = this.countModules(modules, (module) => module.ipcHints.length > 0);
    const appShellSignals = this.countModules(modules, (module) =>
      this.isElectronMainFile(module.relativePath) ||
      this.isElectronPreloadFile(module.relativePath) ||
      module.relativePath.toLowerCase().endsWith('app.tsx') ||
      module.relativePath.toLowerCase().endsWith('main.tsx') ||
      module.relativePath.toLowerCase().endsWith('renderer.tsx') ||
      module.relativePath.toLowerCase().endsWith('router.tsx')
    );
    const strongRendererSignals = this.countModules(modules, (module) =>
      this.isElectronRendererFile(module.relativePath) &&
      (module.relativePath.includes('/renderer/') || module.relativePath.includes('/main/') || module.relativePath.includes('/preload/') || module.relativePath.includes('/src/renderer/')) &&
      (module.kind === 'entry' || module.routeHints.length > 0 || module.storeHints.length > 0 || module.ipcHints.length > 0 || module.relativePath.toLowerCase().endsWith('app.tsx') || module.relativePath.toLowerCase().endsWith('main.tsx') || module.relativePath.toLowerCase().endsWith('renderer.tsx') || module.relativePath.toLowerCase().endsWith('router.tsx'))
    );
    const weakUiSignals = this.countModules(modules, (module) =>
      (module.kind === 'component' || module.kind === 'hook') &&
      !this.isElectronMainFile(module.relativePath) &&
      !this.isElectronPreloadFile(module.relativePath) &&
      !module.routeHints.length &&
      !module.storeHints.length &&
      !module.ipcHints.length &&
      !module.relativePath.toLowerCase().includes('/renderer/') &&
      !module.relativePath.toLowerCase().includes('/main/')
    );
    const hasAppStructure = mainSignals > 0 || preloadSignals > 0 || ipcSignals > 0 || routeSignals > 0 || storeSignals > 0 || appShellSignals > 0;

    const coreSignalScore =
      Math.min(electronCoreDeps * 16, 32) +
      Math.min(reactDeps * 8, 16) +
      Math.min(viteDeps * 6, 12) +
      Math.min(mainSignals * 16, 32) +
      Math.min(preloadSignals * 14, 28) +
      Math.min(rendererSignals * 10, 20) +
      Math.min(strongRendererSignals * 12, 24) +
      Math.min(ipcSignals * 14, 42) +
      Math.min(routeSignals * 7, 21) +
      Math.min(storeSignals * 6, 18) +
      Math.min(appShellSignals * 8, 24) +
      Math.min(packageSignals * 4, 12);

    const weakUiPenalty = hasAppStructure ? 0 : Math.min(weakUiSignals * 8, 32) + Math.max(0, 12 - electronCoreDeps * 4) + (rendererSignals > 0 ? 6 : 0);
    const supportBonus = Math.min((electronDeps - electronCoreDeps) * 2, 10);
    const appStructureBonus = hasAppStructure ? 8 : 0;

    return this.boundScore(coreSignalScore + supportBonus + appStructureBonus - weakUiPenalty, 100);
  }

  private scoreLibraryPackageProfile(packageInfo: PackageInfo, modules: ScannedFile[]): number {
    const packageSignals = this.countLibraryPackageSignals(packageInfo);
    const strongManifestSignals = this.hasStrongLibraryPackageManifestSignals(packageInfo) ? 1 : 0;
    const entrySignals = modules.filter((module) => this.isLibraryEntryFile(module.relativePath) || this.isLibraryPackageSignal(
      module.relativePath,
      module.content,
      module.imports,
      module.exports,
      module.kind,
      module.hasJsx,
      module.routeHints,
      module.storeHints,
      {
        category: module.contextCategory,
        includeInPrimaryContext: module.includeInPrimaryContext,
        excludeReason: module.excludeReason,
        reason: module.classificationReason,
        basis: module.classificationBasis,
        isAmbiguous: module.isAmbiguous,
      },
      packageInfo,
    ));
    const exportSurfaceModules = modules.filter((module) => this.isLibraryPackageSignal(
      module.relativePath,
      module.content,
      module.imports,
      module.exports,
      module.kind,
      module.hasJsx,
      module.routeHints,
      module.storeHints,
      {
        category: module.contextCategory,
        includeInPrimaryContext: module.includeInPrimaryContext,
        excludeReason: module.excludeReason,
        reason: module.classificationReason,
        basis: module.classificationBasis,
        isAmbiguous: module.isAmbiguous,
      },
      packageInfo,
    ));
    const appSignals = this.countModules(modules, (module) =>
      module.routeHints.length > 0 ||
      module.ipcHints.length > 0 ||
      module.storeHints.length > 0 ||
      module.relativePath.includes('/renderer/') ||
      module.relativePath.includes('/preload/') ||
      this.isElectronMainFile(module.relativePath) ||
      module.kind === 'component' ||
      module.kind === 'route' ||
      module.kind === 'store'
    );

    const score = this.boundScore(
      Math.min(packageSignals * 12, 60) +
      (strongManifestSignals ? 10 : 0) +
      Math.min(entrySignals.length * 12, 30) +
      Math.min(exportSurfaceModules.length * 4, 16) -
      Math.min(appSignals * 7, 42),
      100,
    );

    if (packageSignals < 2 && entrySignals.length === 0) {
      return Math.min(score, 18);
    }

    return score;
  }

  private countDependencySignals(packageInfo: PackageInfo, dependencyNames: string[]): number {
    const allDeps = new Set([
      ...Object.keys(packageInfo.dependencies || {}),
      ...Object.keys(packageInfo.devDependencies || {}),
    ].map((name) => name.toLowerCase()));

    return dependencyNames.reduce((count, name) => count + (allDeps.has(name.toLowerCase()) ? 1 : 0), 0);
  }

  private countPackageSignals(values: Array<string | null | undefined>): number {
    return values.reduce((count, value) => count + (typeof value === 'string' && value.trim() ? 1 : 0), 0);
  }

  private countLibraryPackageSignals(packageInfo: PackageInfo): number {
    const signals = [
      packageInfo.exports,
      packageInfo.main,
      packageInfo.module,
      packageInfo.types,
      packageInfo.packageType,
      packageInfo.bin,
      packageInfo.files.length > 0 ? packageInfo.files : null,
    ];
    return signals.reduce<number>((count, value) => count + (value ? 1 : 0), 0);
  }

  private hasStrongLibraryPackageManifestSignals(packageInfo: PackageInfo): boolean {
    return Boolean(packageInfo.exports) || [
      packageInfo.main,
      packageInfo.module,
      packageInfo.types,
      packageInfo.bin,
    ].filter((value) => Boolean(value)).length >= 2 || packageInfo.files.length > 0;
  }

  private countModules(modules: ScannedFile[], predicate: (module: ScannedFile) => boolean): number {
    return modules.reduce((count, module) => count + (predicate(module) ? 1 : 0), 0);
  }

  private rebalanceProfileImportance(modules: ScannedFile[], profileScores: Record<RepoProfileName, number>, activeProfiles: RepoProfileName[]): void {
    const activeProfileSet = new Set(activeProfiles);

    for (const module of modules) {
      if (!module.includeInPrimaryContext) {
        continue;
      }

      const bonus = this.getProfileImportanceBonus(module, profileScores, activeProfileSet);
      if (bonus <= 0) {
        continue;
      }

      module.importanceScore = this.boundScore(module.importanceScore + bonus, 100);
    }
  }

  private getProfileImportanceBonus(
    module: ScannedFile,
    profileScores: Record<RepoProfileName, number>,
    activeProfileSet: Set<RepoProfileName>,
  ): number {
    let bonus = 0;

    if (activeProfileSet.has('python') && module.matchedProfiles.includes('python')) {
      bonus += Math.max(8, Math.round(profileScores.python / 12));
      if (module.kind === 'entry' || module.kind === 'config') bonus += 4;
    }

    if (activeProfileSet.has('script-heavy') && module.matchedProfiles.includes('script-heavy')) {
      bonus += Math.max(6, Math.round(profileScores['script-heavy'] / 14));
      if (module.kind === 'entry' || module.kind === 'config' || module.kind === 'service') bonus += 3;
    }

    if (activeProfileSet.has('electron-frontend') && module.matchedProfiles.includes('electron-frontend')) {
      bonus += Math.max(7, Math.round(profileScores['electron-frontend'] / 14));
      if (module.kind === 'entry' || module.kind === 'route' || module.kind === 'store') bonus += 4;
    }

    if (activeProfileSet.has('library-package') && module.matchedProfiles.includes('library-package')) {
      bonus += Math.max(7, Math.round(profileScores['library-package'] / 14));
      if (module.kind === 'entry' || module.kind === 'config' || module.exports.length > 0) bonus += 4;
    }

    return bonus;
  }

  private getProfileDirectoryWeight(module: ScannedFile, activeProfiles: RepoProfileName[]): number {
    let weight = Math.max(1, 1 + Math.floor(module.importanceScore / 30));

    if (activeProfiles.includes('python') && module.matchedProfiles.includes('python')) {
      weight += 2;
    }
    if (activeProfiles.includes('script-heavy') && module.matchedProfiles.includes('script-heavy')) {
      weight += 2;
    }
    if (activeProfiles.includes('electron-frontend') && module.matchedProfiles.includes('electron-frontend')) {
      weight += 2;
    }
    if (activeProfiles.includes('library-package') && module.matchedProfiles.includes('library-package')) {
      weight += 2;
    }

    return weight;
  }

  private appendProfileEntryPointReasons(module: ScannedFile, activeProfiles: RepoProfileName[], reasons: string[]): void {
    if (activeProfiles.includes('python') && module.matchedProfiles.includes('python')) {
      reasons.push('python-profile');
    }
    if (activeProfiles.includes('script-heavy') && module.matchedProfiles.includes('script-heavy')) {
      reasons.push('script-heavy-profile');
    }
    if (activeProfiles.includes('electron-frontend') && module.matchedProfiles.includes('electron-frontend')) {
      reasons.push('electron-frontend-profile');
    }
    if (activeProfiles.includes('library-package') && module.matchedProfiles.includes('library-package')) {
      reasons.push('library-package-profile');
    }
  }

  private isStrongScriptHeavySignal(
    relativePath: string,
    content: string,
    imports: string[],
    exports: string[],
    kind: FileKind,
    classification: {
      category: RepoContextCategory;
      includeInPrimaryContext: boolean;
      excludeReason: string | null;
      reason: string;
      basis: string;
      isAmbiguous: boolean;
    },
    packageInfo: PackageInfo,
    routeHints: string[],
    storeHints: string[],
  ): boolean {
    const lower = relativePath.toLowerCase();
    const isReferencedByScript = this.findPackageScriptReference({ relativePath, content, imports, exports, kind, contextCategory: classification.category, matchedProfiles: [], includeInPrimaryContext: classification.includeInPrimaryContext, excludeReason: classification.excludeReason, classificationReason: classification.reason, classificationBasis: classification.basis, isAmbiguous: classification.isAmbiguous, importanceScore: 0, size: 0, absolutePath: relativePath, hasJsx: false, routeHints, ipcHints: [], storeHints }, packageInfo) !== null;
    const isReferencedByPrimary = classification.includeInPrimaryContext && this.findPrimaryFileReference({ relativePath, content, imports, exports, kind, contextCategory: classification.category, matchedProfiles: [], includeInPrimaryContext: classification.includeInPrimaryContext, excludeReason: classification.excludeReason, classificationReason: classification.reason, classificationBasis: classification.basis, isAmbiguous: classification.isAmbiguous, importanceScore: 0, size: 0, absolutePath: relativePath, hasJsx: false, routeHints, ipcHints: [], storeHints }, [ { relativePath, content, imports, exports, kind, contextCategory: classification.category, matchedProfiles: [], includeInPrimaryContext: classification.includeInPrimaryContext, excludeReason: classification.excludeReason, classificationReason: classification.reason, classificationBasis: classification.basis, isAmbiguous: classification.isAmbiguous, importanceScore: 0, size: 0, absolutePath: relativePath, hasJsx: false, routeHints, ipcHints: [], storeHints } ]) !== null;
    const isExecutableShell = this.isShellOrRunnerFile(relativePath, content) || this.isBinOrCLIFile(relativePath);
    const isBuildFlow = /(?:build|start|dev|run|package|bootstrap|setup)/i.test(Object.values(packageInfo.scripts || {}).join(' '));
    const isRuntimePackaging = this.isRuntimeRelevantTooling(relativePath) || lower.includes('/bin/') || lower.includes('/cli/') || lower.includes('/scripts/') || lower.includes('/tools/');
    const isMaintenanceOnly = lower.includes('/maintenance/') || lower.includes('/maint/') || lower.includes('/migrations/') || lower.includes('/migration/') || lower.includes('/debug/') || lower.includes('/prompt/') || lower.includes('/prompts/') || lower.includes('/workspace/') || lower.includes('/admin/');
    const hasRealFlow = isReferencedByScript || isReferencedByPrimary || isBuildFlow || isRuntimePackaging || kind === 'entry' || routeHints.length > 0 || storeHints.length > 0;

    if (isMaintenanceOnly) {
      return false;
    }

    return hasRealFlow && !(!isReferencedByScript && !isReferencedByPrimary && isExecutableShell && !isBuildFlow && !isRuntimePackaging);
  }

  private isStrongElectronFrontendSignal(
    relativePath: string,
    content: string,
    hasJsx: boolean,
    routeHints: string[],
    storeHints: string[],
    kind: FileKind,
    classification: {
      category: RepoContextCategory;
      includeInPrimaryContext: boolean;
      excludeReason: string | null;
      reason: string;
      basis: string;
      isAmbiguous: boolean;
    },
    packageInfo: PackageInfo,
  ): boolean {
    const lower = relativePath.toLowerCase();
    const hasElectronDeps = this.countDependencySignals(packageInfo, ['electron']) > 0;
    const hasFrontendDeps = this.countDependencySignals(packageInfo, ['react', 'react-dom', 'react-router-dom', 'vite', 'tailwindcss']) > 0;
    const hasAppShell = this.isElectronMainFile(relativePath) || this.isElectronPreloadFile(relativePath) || lower.endsWith('app.tsx') || lower.endsWith('main.tsx') || lower.endsWith('renderer.tsx') || lower.endsWith('router.tsx');
    const hasIPC = /ipcMain\.handle\(|ipcRenderer\.invoke\(|contextBridge\.exposeInMainWorld/.test(content);
    const hasStructuralSignals = routeHints.length > 0 || storeHints.length > 0 || kind === 'store' || kind === 'route';
    const isRendererPath = this.isElectronRendererFile(relativePath) && (lower.includes('/renderer/') || lower.includes('/pages/') || lower.includes('/components/'));
    const isCoreAppClassification = classification.category === 'core-app';
    const hasRendererDeps = hasFrontendDeps && (isRendererPath || hasAppShell);
    const hasStrongAppStructure = hasElectronDeps && (hasAppShell || hasIPC || hasStructuralSignals || hasRendererDeps);

    if (hasStrongAppStructure) {
      return true;
    }

    if (hasElectronDeps && hasFrontendDeps && hasJsx && isCoreAppClassification && hasAppShell && (routeHints.length > 0 || storeHints.length > 0 || lower.endsWith('app.tsx'))) {
      return true;
    }

    if (hasIPC && (hasAppShell || isRendererPath)) {
      return true;
    }

    if (hasAppShell && hasFrontendDeps && (routeHints.length > 0 || storeHints.length > 0)) {
      return true;
    }

    return false;
  }

  private isLibraryPackageSignal(
    relativePath: string,
    content: string,
    imports: string[],
    exports: string[],
    kind: FileKind,
    hasJsx: boolean,
    routeHints: string[],
    storeHints: string[],
    classification: {
      category: RepoContextCategory;
      includeInPrimaryContext: boolean;
      excludeReason: string | null;
      reason: string;
      basis: string;
      isAmbiguous: boolean;
    },
    packageInfo: PackageInfo,
  ): boolean {
    if (!this.hasStrongLibraryPackageManifestSignals(packageInfo)) {
      return false;
    }

    if (relativePath.toLowerCase() === 'package.json') {
      return true;
    }

    if (this.isLibraryEntryFile(relativePath)) {
      return true;
    }

    const lower = relativePath.toLowerCase();
    const apiLikePath = lower.includes('/api/') || lower.includes('/public/') || lower.includes('/exports/') || lower.includes('/lib/') || lower.includes('/src/index') || lower.includes('/src/mod');
    const exportSurface = exports.length > 0 && imports.length <= 3 && !hasJsx && kind !== 'component' && kind !== 'route' && kind !== 'store';
    const packageSurface = apiLikePath && (exportSurface || kind === 'util' || kind === 'service');
    const notAppShell = routeHints.length === 0 && storeHints.length === 0 && classification.category !== 'core-app' && !this.isElectronRendererFile(relativePath) && !this.isElectronPreloadFile(relativePath);

    return notAppShell && (packageSurface || exportSurface);
  }

  private isPythonFile(relativePath: string): boolean {
    return relativePath.toLowerCase().endsWith('.py');
  }

  private isPythonEntryPoint(relativePath: string): boolean {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);
    return ['main.py', 'app.py', 'cli.py', 'server.py', '__main__.py'].includes(baseName) || lower.includes('/main.py') || lower.includes('/app.py') || lower.includes('/cli.py') || lower.includes('/server.py');
  }

  private isPythonConfig(relativePath: string): boolean {
    const baseName = path.basename(relativePath).toLowerCase();
    return ['pyproject.toml', 'requirements.txt', 'setup.py', 'pipfile', 'poetry.lock'].includes(baseName);
  }

  private containsPythonFrameworkClue(content: string): boolean {
    return /\b(flask|django|fastapi|starlette|uvicorn|click|typer|pydantic|sqlalchemy|pytest|aiohttp|streamlit|gradio)\b/i.test(content);
  }

  private isScriptOrToolPath(relativePath: string): boolean {
    const lower = relativePath.toLowerCase();
    return lower.includes('/scripts/') || lower.includes('/script/') || lower.includes('/tools/') || lower.includes('/tool/') || lower.includes('/bin/') || lower.includes('/cli/') || lower.includes('/tasks/') || lower.includes('/task/') || lower.includes('/maintenance/') || lower.includes('/ops/') || lower.includes('/dev/');
  }

  private isShellOrRunnerFile(relativePath: string, content: string): boolean {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);
    return /\.(sh|bash|zsh|ps1|cmd|bat)$/.test(baseName) || /^#!\s*/.test(content) || ['makefile', 'gnumakefile'].includes(baseName);
  }

  private isBinOrCLIFile(relativePath: string): boolean {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);
    return lower.includes('/bin/') || baseName === 'cli.py' || baseName === 'cli.ts' || baseName === 'cli.js' || baseName === 'main.py' || baseName === 'main.ts' || baseName === 'main.js';
  }

  private isElectronMainFile(relativePath: string): boolean {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);
    return lower.includes('/main/') || baseName === 'main.ts' || baseName === 'main.js' || baseName === 'main.tsx' || baseName === 'electron-main.ts' || baseName === 'electron-main.js';
  }

  private isElectronRendererFile(relativePath: string): boolean {
    const lower = relativePath.toLowerCase();
    return lower.includes('/renderer/') || lower.includes('/pages/') || lower.includes('/components/') || lower.endsWith('.tsx');
  }

  private isElectronPreloadFile(relativePath: string): boolean {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);
    return lower.includes('/preload/') || baseName === 'preload.ts' || baseName === 'preload.js';
  }

  private isLibraryEntryFile(relativePath: string): boolean {
    const lower = relativePath.toLowerCase();
    const baseName = path.basename(lower);
    return lower === 'index.ts' || lower === 'index.js' || lower === 'src/index.ts' || lower === 'src/index.js' || baseName === 'index.tsx' || baseName === 'index.mts' || baseName === 'index.cts' || baseName === 'mod.ts';
  }

  private boundScore(score: number, max: number): number {
    return Math.max(0, Math.min(Math.round(score), max));
  }

  private resolvePrimaryTooling(modules: ScannedFile[], packageInfo: PackageInfo): void {
    let changed = true;

    while (changed) {
      changed = false;
      const primaryModules = modules.filter((module) => module.includeInPrimaryContext);

      for (const module of modules) {
        if (module.contextCategory !== 'tooling' || module.includeInPrimaryContext) {
          continue;
        }

        const decision = this.evaluateToolingInclusion(module, primaryModules, packageInfo);
        module.classificationReason = decision.reason;
        module.classificationBasis = decision.basis;
        module.includeInPrimaryContext = decision.include;
        module.excludeReason = decision.include ? null : decision.excludeReason;
        if (decision.include) {
          const matchedProfiles = new Set<RepoProfileName>(module.matchedProfiles);
          matchedProfiles.add('script-heavy');
          module.matchedProfiles = [...matchedProfiles];
        }
        module.importanceScore = decision.include
          ? this.scoreFile(
            module.relativePath,
            module.kind,
            module.content,
            module.imports,
            module.exports,
            module.routeHints,
            module.ipcHints,
            module.storeHints,
            true,
          )
          : 0;

        if (decision.include) {
          changed = true;
        }
      }
    }
  }

  private evaluateToolingInclusion(
    module: ScannedFile,
    primaryModules: ScannedFile[],
    packageInfo: PackageInfo,
  ): {
    include: boolean;
    reason: string;
    basis: string;
    excludeReason: string;
  } {
    const scriptReference = this.findPackageScriptReference(module, packageInfo);
    if (scriptReference) {
      return {
        include: true,
        reason: `Referenced by package.json script "${scriptReference}"`,
        basis: 'tooling-reference:package-script',
        excludeReason: '',
      };
    }

    const primaryReference = this.findPrimaryFileReference(module, primaryModules);
    if (primaryReference) {
      return {
        include: true,
        reason: `Referenced or imported by primary file ${primaryReference}`,
        basis: 'tooling-reference:primary-file',
        excludeReason: '',
      };
    }

    const lowerPath = module.relativePath.toLowerCase();
    if (lowerPath.includes('/debug/') || /(?:^|[._-])debug(?:[._-]|$)/.test(path.basename(lowerPath))) {
      return {
        include: false,
        reason: 'Excluded because debug utility',
        basis: 'tooling-suppression:debug-utility',
        excludeReason: 'debug-utility',
      };
    }

    if (lowerPath.includes('/migrations/') || lowerPath.includes('/migration/') || /(?:^|[._-])migration(?:[._-]|$)/.test(path.basename(lowerPath))) {
      return {
        include: false,
        reason: 'Excluded because one-off migration',
        basis: 'tooling-suppression:one-off-migration',
        excludeReason: 'one-off-migration',
      };
    }

    if (lowerPath.includes('/maintenance/') || lowerPath.includes('/maint/') || /(?:^|[._-])maint(?:[._-]|$)/.test(path.basename(lowerPath))) {
      return {
        include: false,
        reason: 'Excluded because maintenance-only script',
        basis: 'tooling-suppression:maintenance-script',
        excludeReason: 'maintenance-only',
      };
    }

    if (lowerPath.includes('/admin/') || lowerPath.includes('/workspace/') || lowerPath.includes('/meta/') || lowerPath.includes('/ops/') || lowerPath.includes('/internal/')) {
      return {
        include: false,
        reason: 'Excluded because workspace/admin-only script',
        basis: 'tooling-suppression:workspace-admin',
        excludeReason: 'workspace-admin-only',
      };
    }

    if (lowerPath.includes('/prompt/') || lowerPath.includes('/prompts/') || lowerPath.includes('/prompt-generation/') || /(?:^|[._-])prompt(?:[._-]|$)/.test(path.basename(lowerPath))) {
      return {
        include: false,
        reason: 'Excluded because prompt-generation-only script',
        basis: 'tooling-suppression:prompt-generation',
        excludeReason: 'prompt-generation-only',
      };
    }

    if (lowerPath.includes('/archive/') || lowerPath.includes('/archives/') || lowerPath.includes('/old/') || lowerPath.includes('/backup/') || /(?:^|[._-])(old|backup|archive|draft|copy)(?:[._-]|$)/.test(path.basename(lowerPath))) {
      return {
        include: false,
        reason: 'Excluded because archive-old script',
        basis: 'tooling-suppression:archive-copy',
        excludeReason: 'archive-old',
      };
    }

    if (lowerPath.includes('/util/') || lowerPath.includes('/utilities/') || lowerPath.includes('/helpers/') || /(?:^|[._-])(utility|utilities|helper|helpers)(?:[._-]|$)/.test(path.basename(lowerPath))) {
      return {
        include: false,
        reason: 'Excluded because ad hoc utility script',
        basis: 'tooling-suppression:ad-hoc-utility',
        excludeReason: 'ad-hoc-utility',
      };
    }

    if (lowerPath.includes('/scripts/') || lowerPath.includes('/tools/') || lowerPath.includes('/tooling/')) {
      return {
        include: false,
        reason: 'Excluded because unreferenced maintenance script',
        basis: 'tooling-suppression:unreferenced-maintenance-script',
        excludeReason: 'unreferenced-maintenance-script',
      };
    }

    if (lowerPath.includes('/workspace/') || lowerPath.includes('/admin/') || lowerPath.includes('/prompt/') || lowerPath.includes('/prompts/')) {
      return {
        include: false,
        reason: 'Excluded because workspace/meta script',
        basis: 'tooling-suppression:workspace-meta-script',
        excludeReason: 'workspace-meta-script',
      };
    }

    return {
      include: false,
      reason: 'Excluded because unreferenced tooling file',
      basis: 'tooling-suppression:unreferenced-tooling',
      excludeReason: 'unreferenced-tooling',
    };
  }

  private findPackageScriptReference(module: ScannedFile, packageInfo: PackageInfo): string | null {
    const normalizedPath = module.relativePath.replace(/\\/g, '/').toLowerCase();
    const pathWithoutExt = normalizedPath.replace(/\.[^.]+$/, '');
    const baseName = path.basename(normalizedPath);
    const stem = baseName.replace(/\.[^.]+$/, '');
    const scriptEntries = Object.entries(packageInfo.scripts || {});

    for (const [scriptName, command] of scriptEntries) {
      const normalizedCommand = command.toLowerCase().replace(/\\/g, '/');
      const commandMatches = [
        normalizedPath,
        pathWithoutExt,
        baseName,
        stem,
      ].some((token) => token && normalizedCommand.includes(token));

      if (commandMatches) {
        return scriptName;
      }
    }

    return null;
  }

  private findPrimaryFileReference(module: ScannedFile, primaryModules: ScannedFile[]): string | null {
    const normalizedPath = module.relativePath.replace(/\\/g, '/').toLowerCase();
    const pathWithoutExt = normalizedPath.replace(/\.[^.]+$/, '');
    const baseName = path.basename(normalizedPath);
    const stem = baseName.replace(/\.[^.]+$/, '');
    const pathSuffixes = this.buildPathSuffixes(pathWithoutExt);

    for (const primary of primaryModules) {
      const content = primary.content.toLowerCase().replace(/\\/g, '/');
      const imports = primary.imports.map((value) => value.toLowerCase());
      const importMatch = imports.some((value) =>
        pathSuffixes.some((suffix) => value === suffix || value.endsWith(`/${suffix}`) || value.endsWith(suffix))
      );
      if (importMatch) {
        return primary.relativePath;
      }

      const contentMentionsPath = content.includes(normalizedPath) || content.includes(pathWithoutExt);
      if (contentMentionsPath) {
        return primary.relativePath;
      }

      const invocationContext = /(?:exec(?:sync)?|spawn(?:sync)?|execa|child_process|node|tsx|ts-node|bun|deno|vite|electron-builder|npm run|pnpm|yarn)/i.test(content);
      if (invocationContext && (content.includes(baseName) || content.includes(stem) || pathSuffixes.some((suffix) => content.includes(suffix)))) {
        return primary.relativePath;
      }
    }

    return null;
  }

  private buildPathSuffixes(pathWithoutExt: string): string[] {
    const segments = pathWithoutExt.split('/').filter(Boolean);
    const suffixes: string[] = [];
    for (let index = 0; index < segments.length; index += 1) {
      suffixes.push(segments.slice(index).join('/'));
    }
    return [...new Set(suffixes)].sort((a, b) => b.length - a.length);
  }

  private collectPrimarySignals(primaryModules: ScannedFile[]): {
    routes: Array<{ route: string; sourceFile: string; pattern: string }>;
    ipc: {
      mainHandlers: string[];
      rendererCalls: string[];
      preloadExposedApis: string[];
    };
    stores: Array<{ file: string; storeName: string; actions: string[]; evidence: string[] }>;
    docs: Array<{ relativePath: string; title: string; importanceScore: number }>;
  } {
    const routes: Array<{ route: string; sourceFile: string; pattern: string }> = [];
    const ipcMainHandlers = new Set<string>();
    const rendererCalls = new Set<string>();
    const preloadExposedApis = new Set<string>();
    const stores: Array<{ file: string; storeName: string; actions: string[]; evidence: string[] }> = [];
    const docs: Array<{ relativePath: string; title: string; importanceScore: number }> = [];

    for (const module of primaryModules) {
      if (module.kind === 'route' || module.routeHints.length > 0) {
        for (const route of module.routeHints) {
          routes.push({ route, sourceFile: module.relativePath, pattern: 'route-declaration' });
        }
      }

      for (const handler of this.extractMainIpcHandlers(module.content)) {
        ipcMainHandlers.add(handler);
      }
      for (const call of this.extractRendererCalls(module.content)) {
        rendererCalls.add(call);
      }
      for (const api of this.extractPreloadApis(module.content)) {
        preloadExposedApis.add(api);
      }

      if (module.kind === 'store' || module.storeHints.length > 0) {
        stores.push({
          file: module.relativePath,
          storeName: this.extractStoreName(module.relativePath, module.content),
          actions: this.extractStoreActions(module.content),
          evidence: module.storeHints,
        });
      }

      if (module.kind === 'doc' || module.contextCategory === 'core-app') {
        docs.push({
          relativePath: module.relativePath,
          title: module.docTitle || path.basename(module.relativePath),
          importanceScore: module.importanceScore,
        });
      }
    }

    routes.sort((a, b) => a.sourceFile.localeCompare(b.sourceFile) || a.route.localeCompare(b.route));
    const uniqueRoutes = [...new Map(routes.map((route) => [`${route.sourceFile}::${route.route}`, route])).values()];
    stores.sort((a, b) => a.file.localeCompare(b.file));
    docs.sort((a, b) => b.importanceScore - a.importanceScore || a.relativePath.localeCompare(b.relativePath));

    return {
      routes: uniqueRoutes,
      ipc: {
        mainHandlers: [...ipcMainHandlers].sort(),
        rendererCalls: [...rendererCalls].sort(),
        preloadExposedApis: [...preloadExposedApis].sort(),
      },
      stores,
      docs,
    };
  }

  private buildFrameworkClues(packageInfo: PackageInfo, modules: ScannedFile[], pythonProjectInfo: PythonProjectInfo): string[] {
    const clues = new Set<string>();
    const depNames = new Set([
      ...Object.keys(packageInfo.dependencies),
      ...Object.keys(packageInfo.devDependencies),
    ].map((name) => name.toLowerCase()));

    if (pythonProjectInfo.hasPyproject || pythonProjectInfo.hasRequirements || pythonProjectInfo.hasSetupPy || pythonProjectInfo.hasPipfile || pythonProjectInfo.hasPoetryLock || modules.some((module) => this.isPythonFile(module.relativePath) || this.isPythonConfig(module.relativePath))) {
      clues.add('Python');
    }
    if (pythonProjectInfo.hasPyproject || pythonProjectInfo.hasRequirements || pythonProjectInfo.hasSetupPy || pythonProjectInfo.hasPipfile || pythonProjectInfo.hasPoetryLock) {
      clues.add('Python Project');
    }
    if (modules.some((module) => this.isPythonEntryPoint(module.relativePath))) clues.add('Python Entrypoint');
    for (const clue of pythonProjectInfo.frameworkHints) {
      clues.add(`Python Framework: ${clue}`);
    }
    for (const module of modules) {
      for (const clue of this.extractPythonFrameworkClues(module.content)) {
        clues.add(`Python Framework: ${clue}`);
      }
    }
    if (depNames.has('electron')) clues.add('Electron');
    if (depNames.has('react') || modules.some((module) => module.relativePath.includes('/renderer/') || module.relativePath.endsWith('.tsx'))) clues.add('React');
    if (depNames.has('react-router-dom') || modules.some((module) => module.routeHints.length > 0)) clues.add('React Router');
    if (depNames.has('zustand') || modules.some((module) => module.kind === 'store')) clues.add('Zustand');
    if (depNames.has('tailwindcss')) clues.add('Tailwind CSS');
    if (depNames.has('vite') || modules.some((module) => module.relativePath.startsWith('vite.config'))) clues.add('Vite');
    if (depNames.has('typescript') || modules.some((module) => module.relativePath.startsWith('tsconfig'))) clues.add('TypeScript');
    if (depNames.has('electron-builder') || modules.some((module) => module.relativePath === 'electron-builder.json')) clues.add('Electron Builder');
    if (modules.some((module) => module.relativePath.includes('/main/'))) clues.add('Electron Main Process');
    if (modules.some((module) => module.relativePath.includes('/renderer/'))) clues.add('React Renderer');

    return [...clues].sort();
  }

  private async readPackageInfo(repoRoot: string): Promise<PackageInfo> {
    const packagePath = path.join(repoRoot, 'package.json');
    try {
      const raw = await fs.readFile(packagePath, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown> & { name?: string };
      const binValue = parsed.bin;
      return {
        name: typeof parsed.name === 'string' ? parsed.name : null,
        scripts: (parsed.scripts && typeof parsed.scripts === 'object') ? (parsed.scripts as Record<string, string>) : {},
        dependencies: (parsed.dependencies && typeof parsed.dependencies === 'object') ? (parsed.dependencies as Record<string, string>) : {},
        devDependencies: (parsed.devDependencies && typeof parsed.devDependencies === 'object') ? (parsed.devDependencies as Record<string, string>) : {},
        exports: parsed.exports ?? null,
        main: typeof parsed.main === 'string' ? parsed.main : null,
        module: typeof parsed.module === 'string' ? parsed.module : null,
        types: typeof parsed.types === 'string' ? parsed.types : null,
        bin: typeof binValue === 'string' || (binValue && typeof binValue === 'object') ? (binValue as Record<string, string> | string) : null,
        files: Array.isArray(parsed.files) ? parsed.files.filter((value): value is string => typeof value === 'string') : [],
        packageType: typeof parsed.type === 'string' ? parsed.type : null,
      };
    } catch {
      return {
        name: null,
        scripts: {},
        dependencies: {},
        devDependencies: {},
        exports: null,
        main: null,
        module: null,
        types: null,
        bin: null,
        files: [],
        packageType: null,
      };
    }
  }

  private async readPythonProjectInfo(repoRoot: string): Promise<PythonProjectInfo> {
    const manifestFiles = ['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile', 'poetry.lock'];
    const info: PythonProjectInfo = {
      manifestFiles: [],
      hasPyproject: false,
      pyprojectName: null,
      pyprojectDependencyCount: 0,
      hasRequirements: false,
      requirementsCount: 0,
      hasSetupPy: false,
      setupName: null,
      hasPipfile: false,
      pipfilePackageCount: 0,
      hasPoetryLock: false,
      poetryPackageCount: 0,
      frameworkHints: [],
    };

    for (const filename of manifestFiles) {
      const filePath = path.join(repoRoot, filename);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        info.manifestFiles.push(filename);
        const lower = filename.toLowerCase();

        if (lower === 'pyproject.toml') {
          info.hasPyproject = true;
          info.pyprojectName = this.extractTomlString(content, ['project', 'name']) || this.extractTomlString(content, ['tool', 'poetry', 'name']);
          info.pyprojectDependencyCount = this.countPythonDependencyLines(content);
          this.collectPythonFrameworkHints(content, info.frameworkHints);
        } else if (lower === 'requirements.txt') {
          info.hasRequirements = true;
          info.requirementsCount = this.countPythonRequirements(content);
          this.collectPythonFrameworkHints(content, info.frameworkHints);
        } else if (lower === 'setup.py') {
          info.hasSetupPy = true;
          info.setupName = this.extractPythonSetupName(content);
          this.collectPythonFrameworkHints(content, info.frameworkHints);
        } else if (lower === 'pipfile') {
          info.hasPipfile = true;
          info.pipfilePackageCount = this.countPythonPipfilePackages(content);
          this.collectPythonFrameworkHints(content, info.frameworkHints);
        } else if (lower === 'poetry.lock') {
          info.hasPoetryLock = true;
          info.poetryPackageCount = this.countPoetryLockPackages(content);
          this.collectPythonFrameworkHints(content, info.frameworkHints);
        }
      } catch {
        continue;
      }
    }

    info.frameworkHints = [...new Set(info.frameworkHints)].sort();
    return info;
  }

  private extractPythonFrameworkClues(content: string): string[] {
    const hints: string[] = [];
    const regex = /\b(fastapi|flask|django|starlette|uvicorn|click|typer|pydantic|sqlalchemy|aiohttp|streamlit|gradio)\b/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      hints.push(this.normalizePythonFrameworkName(match[1]));
    }
    return [...new Set(hints)].sort();
  }

  private collectPythonFrameworkHints(content: string, hints: string[]): void {
    for (const clue of this.extractPythonFrameworkClues(content)) {
      hints.push(clue);
    }
  }

  private normalizePythonFrameworkName(name: string): string {
    const lower = name.toLowerCase();
    const map: Record<string, string> = {
      fastapi: 'FastAPI',
      flask: 'Flask',
      django: 'Django',
      starlette: 'Starlette',
      uvicorn: 'Uvicorn',
      click: 'Click',
      typer: 'Typer',
      pydantic: 'Pydantic',
      sqlalchemy: 'SQLAlchemy',
      aiohttp: 'AioHTTP',
      streamlit: 'Streamlit',
      gradio: 'Gradio',
    };

    return map[lower] || name;
  }

  private extractTomlString(content: string, pathSegments: string[]): string | null {
    if (pathSegments.length === 2 && pathSegments[0] === 'project' && pathSegments[1] === 'name') {
      const projectMatch = content.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
      if (projectMatch) return projectMatch[1].trim();
    }

    if (pathSegments.length === 3 && pathSegments[0] === 'tool' && pathSegments[1] === 'poetry' && pathSegments[2] === 'name') {
      const poetryMatch = content.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
      if (poetryMatch) return poetryMatch[1].trim();
    }

    return null;
  }

  private countPythonDependencyLines(content: string): number {
    const matches = content.match(/^\s*[A-Za-z0-9_.-]+\s*=\s*\{/gm);
    return matches ? matches.length : 0;
  }

  private countPythonRequirements(content: string): number {
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('-r') && !line.startsWith('--'))
      .length;
  }

  private extractPythonSetupName(content: string): string | null {
    const match = content.match(/name\s*=\s*['"]([^'"]+)['"]/);
    return match ? match[1].trim() : null;
  }

  private countPythonPipfilePackages(content: string): number {
    const packageLines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('[') && !line.startsWith('#') && line.includes('='));
    return packageLines.length;
  }

  private countPoetryLockPackages(content: string): number {
    return (content.match(/^\s*name\s*=\s*"/gm) || []).length;
  }

  private buildOpenQuestions(packageInfo: PackageInfo, analysis: {
    routes: Array<{ route: string; sourceFile: string; pattern: string }>;
    ipc: { mainHandlers: string[]; rendererCalls: string[]; preloadExposedApis: string[] };
    primaryModules: ScannedFile[];
    excludedModules: ScannedFile[];
  }): string[] {
    const questions: string[] = [];

    if (!packageInfo.name) {
      questions.push('No package.json name was discovered at the selected repository root.');
    }

    if (analysis.routes.length === 0) {
      questions.push('No explicit route declarations were detected; routing may be defined indirectly or in files excluded by the scanner.');
    }

    if (analysis.ipc.mainHandlers.length === 0 && analysis.ipc.rendererCalls.length > 0) {
      questions.push('Renderer IPC calls were found, but no matching main-process handlers were detected in the scanned files.');
    }

    if (analysis.ipc.preloadExposedApis.length === 0) {
      questions.push('No preload exposed APIs were detected in the scanned files.');
    }

    if (!analysis.primaryModules.some((module) => module.kind === 'store')) {
      questions.push('No clear global store file was detected, so state management may be local or implemented through a different pattern.');
    }

    if (analysis.excludedModules.length > analysis.primaryModules.length) {
      questions.push('Many files were suppressed from primary context because they matched noise or archive patterns.');
    }

    return questions;
  }

  private async writeJsonAbsolute(filePath: string, data: RepoContextSnapshot): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  private classifyRepoContext(
    relativePath: string,
    content: string,
    hasJsx: boolean,
    routeHints: string[],
    storeHints: string[],
  ): {
    category: RepoContextCategory;
    includeInPrimaryContext: boolean;
    excludeReason: string | null;
    reason: string;
    basis: string;
    isAmbiguous: boolean;
  } {
    const lowerPath = relativePath.toLowerCase();
    const baseName = path.basename(lowerPath);
    const dirName = path.dirname(lowerPath);

    if (this.matchesAnySegment(lowerPath, ['workspace', 'runs', 'logs', 'tmp', 'temp', 'coverage', 'dist', 'build', '.next', '.turbo', '.cache', 'artifacts', 'reports'])) {
      return {
        category: 'workspace-meta',
        includeInPrimaryContext: false,
        excludeReason: 'matched-workspace-or-generated-artifact-path',
        reason: 'Matched workspace or generated-artifact path',
        basis: 'path-suppression:workspace-meta',
        isAmbiguous: false,
      };
    }

    if (this.matchesAnySegment(lowerPath, ['__tests__', 'tests', 'test', 'e2e', 'cypress', 'playwright', 'vitest', 'jest']) || /\.test\./.test(baseName) || /\.spec\./.test(baseName)) {
      return {
        category: 'test',
        includeInPrimaryContext: false,
        excludeReason: 'matched-test-path-or-filename',
        reason: 'Matched test path or filename pattern',
        basis: 'path-suppression:test',
        isAmbiguous: false,
      };
    }

    if (this.matchesAnySegment(lowerPath, ['logs']) || /\.log$/.test(baseName)) {
      return {
        category: 'log-artifact',
        includeInPrimaryContext: false,
        excludeReason: 'matched-log-path-or-extension',
        reason: 'Matched log artifact path or extension',
        basis: 'path-suppression:log-artifact',
        isAmbiguous: false,
      };
    }

    if (this.matchesAnySegment(lowerPath, ['old', 'backup', 'archive', 'deprecated', 'draft', 'copy']) || /\.(bak|old|backup|orig|copy)$/.test(baseName)) {
      return {
        category: 'archive-old',
        includeInPrimaryContext: false,
        excludeReason: 'matched-archive-or-backup-pattern',
        reason: 'Matched archive or backup pattern',
        basis: 'path-suppression:archive-old',
        isAmbiguous: false,
      };
    }

    if (this.isPromptDoc(relativePath)) {
      return {
        category: 'prompt-doc',
        includeInPrimaryContext: false,
        excludeReason: 'matched-prompt-document-path-or-name',
        reason: 'Matched prompt or generated documentation file',
        basis: 'path-suppression:prompt-doc',
        isAmbiguous: false,
      };
    }

    if (this.isPythonConfig(relativePath)) {
      return {
        category: 'tooling',
        includeInPrimaryContext: true,
        excludeReason: null,
        reason: 'Matched Python project or dependency config',
        basis: 'explicit-allowlist:python-config',
        isAmbiguous: false,
      };
    }

    if (this.isPythonEntryPoint(relativePath)) {
      return {
        category: 'core-app',
        includeInPrimaryContext: true,
        excludeReason: null,
        reason: 'Matched Python entrypoint',
        basis: 'explicit-allowlist:python-entrypoint',
        isAmbiguous: false,
      };
    }

    if (this.isPythonFile(relativePath)) {
      const isToolScript = this.isScriptOrToolPath(relativePath);
      return {
        category: isToolScript ? 'tooling' : 'core-app',
        includeInPrimaryContext: !isToolScript,
        excludeReason: isToolScript ? 'python-tool-script' : null,
        reason: isToolScript ? 'Matched Python script/tool file' : 'Matched Python module file',
        basis: isToolScript ? 'python-classification:tool-script' : 'python-classification:module',
        isAmbiguous: false,
      };
    }

    if (this.isRootReadme(relativePath)) {
      return {
        category: 'core-app',
        includeInPrimaryContext: true,
        excludeReason: null,
        reason: 'Matched root README allowlist',
        basis: 'explicit-allowlist:root-readme',
        isAmbiguous: false,
      };
    }

    if (this.isEssentialManifestOrConfig(relativePath)) {
      return {
        category: 'tooling',
        includeInPrimaryContext: true,
        excludeReason: null,
        reason: 'Matched essential manifest or config allowlist',
        basis: 'explicit-allowlist:essential-config',
        isAmbiguous: false,
      };
    }

    if (this.isRuntimeAppSource(relativePath, content, hasJsx, routeHints, storeHints)) {
      return {
        category: 'core-app',
        includeInPrimaryContext: true,
        excludeReason: null,
        reason: 'Matched runtime application source allowlist',
        basis: 'explicit-allowlist:runtime-source',
        isAmbiguous: false,
      };
    }

    if (this.isRuntimeRelevantTooling(relativePath)) {
      return {
        category: 'tooling',
        includeInPrimaryContext: true,
        excludeReason: null,
        reason: 'Matched runtime-relevant tooling allowlist',
        basis: 'explicit-allowlist:runtime-tooling',
        isAmbiguous: false,
      };
    }

    if (this.isToolingPath(relativePath)) {
      return {
        category: 'tooling',
        includeInPrimaryContext: false,
        excludeReason: 'tooling-not-runtime-relevant',
        reason: 'Matched tooling path that is not clearly runtime-relevant',
        basis: 'suppressed:non-essential-tooling',
        isAmbiguous: true,
      };
    }

    return {
      category: 'unknown',
      includeInPrimaryContext: false,
      excludeReason: 'unclassified',
      reason: 'No deterministic primary-context match',
      basis: 'default-exclusion:no-allowlist-match',
      isAmbiguous: true,
    };
  }

  private matchesAnySegment(lowerPath: string, markers: string[]): boolean {
    const segments = lowerPath.split('/').filter(Boolean);
    return markers.some((marker) =>
      segments.some((segment) => segment === marker || segment.includes(marker)) ||
      lowerPath.includes(`/${marker}/`) ||
      lowerPath.startsWith(`${marker}/`) ||
      lowerPath.endsWith(`/${marker}`)
    );
  }

  private isPromptDoc(relativePath: string): boolean {
    const lowerPath = relativePath.toLowerCase();
    const baseName = path.basename(lowerPath);
    return (
      baseName.endsWith('.md') && !this.isRootReadme(relativePath)
    ) || lowerPath.includes('/knowledge/') ||
      lowerPath.includes('/prompt-history/') ||
      ['app_primer.md', 'source_of_truth_index.md', 'repo_context.md', 'full_repo_context.json', 'carry_forward.md', 'job_summary.md', 'review_checklist.json', 'changed_files.json', 'job_result.json', 'code_snippets.md'].includes(baseName);
  }

  private isRootReadme(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    return path.basename(normalized).toLowerCase() === 'readme.md' && !normalized.includes('/');
  }

  private isEssentialManifestOrConfig(relativePath: string): boolean {
    const baseName = path.basename(relativePath).toLowerCase();
    return baseName === 'package.json' ||
      /^tsconfig(\..*)?\.json$/.test(baseName) ||
      /^vite\.config\.(ts|js|mts|cts|mjs|cjs)$/.test(baseName) ||
      baseName === 'electron-builder.json' ||
      baseName === 'postcss.config.js' ||
      baseName === 'tailwind.config.js';
  }

  private isRuntimeAppSource(relativePath: string, content: string, hasJsx: boolean, routeHints: string[], storeHints: string[]): boolean {
    const lowerPath = relativePath.toLowerCase();
    const baseName = path.basename(lowerPath);

    if (lowerPath.startsWith('src/') || lowerPath.includes('/src/')) return true;
    const allowedDirs = [
      '/src/main/',
      '/src/renderer/',
      '/src/preload/',
      '/src/shared/',
      '/src/components/',
      '/src/pages/',
      '/src/routes/',
      '/src/router/',
      '/src/ipc/',
      '/src/stores/',
      '/src/hooks/',
      '/src/services/',
      '/src/utils/',
      '/src/lib/',
      '/src/types/',
      '/main/',
      '/renderer/',
      '/preload/',
      '/components/',
      '/pages/',
      '/routes/',
      '/router/',
      '/ipc/',
      '/stores/',
      '/hooks/',
      '/services/',
      '/utils/',
      '/lib/',
      '/types/',
    ];

    if (allowedDirs.some((prefix) => lowerPath.includes(prefix))) return true;
    if (['main.ts', 'main.tsx', 'preload.ts', 'app.tsx', 'index.ts', 'index.tsx', 'renderer.tsx', 'router.ts', 'router.tsx'].includes(baseName)) return true;
    if (routeHints.length > 0 || storeHints.length > 0) return true;
    if (/export\s+default\s+/.test(content) && hasJsx) return true;
    return false;
  }

  private isRuntimeRelevantTooling(relativePath: string): boolean {
    const lowerPath = relativePath.toLowerCase();
    const baseName = path.basename(lowerPath);
    return baseName === 'package.json' ||
      /^tsconfig(\..*)?\.json$/.test(baseName) ||
      /^vite\.config\.(ts|js|mts|cts|mjs|cjs)$/.test(baseName) ||
      baseName === 'electron-builder.json' ||
      baseName === 'postcss.config.js' ||
      baseName === 'tailwind.config.js';
  }

  private isToolingPath(relativePath: string): boolean {
    const lowerPath = relativePath.toLowerCase();
    const baseName = path.basename(lowerPath);
    return lowerPath.includes('/config/') ||
      lowerPath.includes('/configs/') ||
      lowerPath.includes('/script/') ||
      lowerPath.includes('/scripts/') ||
      lowerPath.includes('/tool/') ||
      lowerPath.includes('/tools/') ||
      lowerPath.includes('/tooling/') ||
      lowerPath.includes('/cli/') ||
      lowerPath.includes('/bin/') ||
      lowerPath.includes('/tasks/') ||
      lowerPath.includes('/task/') ||
      lowerPath.includes('/maintenance/') ||
      lowerPath.includes('/migrations/') ||
      lowerPath.includes('/ops/') ||
      lowerPath.includes('/dev/') ||
      baseName.startsWith('.eslintrc') ||
      baseName === 'eslint.config.js' ||
      baseName.endsWith('.config.js') ||
      baseName.endsWith('.config.ts') ||
      baseName.endsWith('.config.mjs') ||
      baseName.endsWith('.config.cjs') ||
      baseName.startsWith('tsconfig') ||
      baseName.startsWith('vite.config') ||
      baseName === 'electron-builder.json' ||
      baseName === 'postcss.config.js' ||
      baseName === 'tailwind.config.js' ||
      baseName === 'package.json';
  }

  private toModuleMetadata(module: ScannedFile): RepoFileMetadata {
    return {
      relativePath: module.relativePath,
      kind: module.kind,
      contextCategory: module.contextCategory,
      matchedProfiles: module.matchedProfiles,
      includeInPrimaryContext: module.includeInPrimaryContext,
      excludeReason: module.excludeReason,
      classificationBasis: module.classificationBasis,
      imports: module.imports,
      exports: module.exports,
      size: module.size,
      importanceScore: module.importanceScore,
    };
  }

  private buildSuppressionSummary(primaryModules: ScannedFile[], excludedModules: ScannedFile[]): RepoContextSnapshot['suppressionSummary'] {
    const suppressedByCategory: Partial<Record<RepoContextCategory, number>> = {};
    const reasonCounts = new Map<string, number>();
    const allModules = [...primaryModules, ...excludedModules];

    for (const module of excludedModules) {
      suppressedByCategory[module.contextCategory] = (suppressedByCategory[module.contextCategory] || 0) + 1;
      const reason = module.excludeReason || 'excluded';
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }

    return {
      primaryFiles: primaryModules.length,
      excludedFiles: excludedModules.length,
      classificationCounts: this.countByClassification(allModules),
      suppressedByCategory,
      suppressedReasons: [...reasonCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 12)
        .map(([reason, count]) => ({ reason, count })),
    };
  }

  private orderModulesForReview(modules: ScannedFile[]): ScannedFile[] {
    return modules.slice().sort((a, b) => {
      if (a.includeInPrimaryContext !== b.includeInPrimaryContext) {
        return a.includeInPrimaryContext ? -1 : 1;
      }
      if (a.contextCategory !== b.contextCategory) {
        return a.contextCategory.localeCompare(b.contextCategory);
      }
      return b.importanceScore - a.importanceScore || a.relativePath.localeCompare(b.relativePath);
    });
  }

  private isInsideRoot(root: string, candidate: string): boolean {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  }
}
