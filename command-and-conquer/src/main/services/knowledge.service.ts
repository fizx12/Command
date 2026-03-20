import * as fs from 'fs/promises';
import { FileStore } from '../storage/file-store';
import { ProjectService } from './project.service';
import { SourceDocument, CheatSheet, SolvedIssue, TrustLevel } from '../types';
import * as crypto from 'crypto';
import * as path from 'path';

export class KnowledgeService {
  private fileStore: FileStore;
  private projectService: ProjectService;
  private obsidianBasePath?: string;

  constructor(fileStore: FileStore, projectService: ProjectService, obsidianBasePath?: string) {
    this.fileStore = fileStore;
    this.projectService = projectService;
    this.obsidianBasePath = obsidianBasePath;
  }

  async listDocs(projectId: string): Promise<SourceDocument[]> {
    try {
      const docs: SourceDocument[] = [];

      const knowledgeRoot = await this.resolveRepoKnowledgeRoot(projectId);
      console.log('[KnowledgeService] listDocs knowledgeRoot:', knowledgeRoot.absolutePath);
      const files = await this.walkKnowledgeFiles(knowledgeRoot.absolutePath);
      console.log('[KnowledgeService] listDocs found files:', files.map(f => f.relativePath));
      for (const file of files) {
        const doc = await this.readKnowledgeDocFile(
          projectId,
          file.absolutePath,
          file.relativePath,
        );
        if (doc) docs.push(doc);
        else console.warn('[KnowledgeService] readKnowledgeDocFile returned null for:', file.absolutePath);
      }

      console.log('[KnowledgeService] listDocs returning', docs.length, 'docs');
      return docs;
    } catch (err) {
      console.error('[KnowledgeService] listDocs ERROR for projectId:', projectId, err);
      return [];
    }
  }

  async getDoc(projectId: string, docId: string): Promise<SourceDocument | null> {
    try {
      const knowledgeRoot = await this.resolveRepoKnowledgeRoot(projectId);

      const jsonDoc = await this.readKnowledgeDocFile(
        projectId,
        path.join(knowledgeRoot.absolutePath, `${docId}.json`),
        `${docId}.json`,
      );
      if (jsonDoc) {
        return jsonDoc;
      }

      const mdDoc = await this.readKnowledgeDocFile(
        projectId,
        path.join(knowledgeRoot.absolutePath, `${docId}.md`),
        `${docId}.md`,
      );
      if (mdDoc) {
        return mdDoc;
      }

      return null;
    } catch {
      return null;
    }
  }

  async createDoc(projectId: string, doc: Omit<SourceDocument, 'id'>): Promise<SourceDocument> {
    const id = 'doc-' + crypto.randomUUID().slice(0, 8);
    const fullDoc: SourceDocument = { ...doc, id };

    await this.writeKnowledgeDoc(projectId, `${id}.json`, fullDoc);
    return fullDoc;
  }

  async updateDoc(projectId: string, docId: string, updates: Partial<SourceDocument>): Promise<SourceDocument> {
    const existing = await this.getDoc(projectId, docId);
    if (!existing) {
      throw new Error(`SourceDocument with ID ${docId} not found in project ${projectId}`);
    }

    const updated: SourceDocument = {
      ...existing,
      ...updates
    };

    await this.writeKnowledgeDoc(projectId, `${docId}.json`, updated);
    return updated;
  }

  async flagStale(projectId: string, docId: string): Promise<void> {
    await this.updateDoc(projectId, docId, { 
      staleFlag: true, 
      trustLevel: 'stale' 
    });
  }

  async clearStaleFlag(projectId: string, docId: string): Promise<void> {
    await this.updateDoc(projectId, docId, { 
      staleFlag: false, 
      lastReviewedAt: new Date().toISOString() 
    });
  }

  async flagConflict(projectId: string, docIdA: string, docIdB: string): Promise<void> {
    const docA = await this.getDoc(projectId, docIdA);
    const docB = await this.getDoc(projectId, docIdB);

    if (!docA || !docB) {
      throw new Error('One or both documents not found for conflict flagging');
    }

    const conflictsWithA = [...new Set([...(docA.conflictsWith || []), docIdB])];
    const conflictsWithB = [...new Set([...(docB.conflictsWith || []), docIdA])];

    await this.updateDoc(projectId, docIdA, { conflictFlag: true, conflictsWith: conflictsWithA });
    await this.updateDoc(projectId, docIdB, { conflictFlag: true, conflictsWith: conflictsWithB });
  }

  async getDocsWithWatchFileOverlap(projectId: string, changedFiles: string[]): Promise<SourceDocument[]> {
    const allDocs = await this.listDocs(projectId);
    const overlappingDocs: SourceDocument[] = [];

    for (const doc of allDocs) {
      if (!doc.watchFiles || doc.watchFiles.length === 0) continue;

      let hasOverlap = false;
      for (const watchFile of doc.watchFiles) {
        for (const changedFile of changedFiles) {
          if (watchFile.endsWith('/**')) {
            const prefix = watchFile.slice(0, -3);
            if (changedFile.startsWith(prefix)) {
              hasOverlap = true;
              break;
            }
          } else if (changedFile === watchFile) {
            hasOverlap = true;
            break;
          }
        }
        if (hasOverlap) break;
      }

      if (hasOverlap) {
        overlappingDocs.push(doc);
      }
    }

    return overlappingDocs;
  }

  async listSolvedIssues(projectId: string): Promise<SolvedIssue[]> {
    try {
      const files = await this.fileStore.listFiles(`workspace/projects/${projectId}/knowledge/solved`);
      const issues: SolvedIssue[] = [];
      
      for (const fileName of files) {
        if (fileName.endsWith('.json')) {
          try {
            const issue = await this.fileStore.readJSON<SolvedIssue>(`workspace/projects/${projectId}/knowledge/solved/${fileName}`);
            if (issue) issues.push(issue);
          } catch {
            // Ignore parse errors
          }
        }
      }
      return issues;
    } catch {
      return [];
    }
  }

  async createSolvedIssue(projectId: string, issue: Omit<SolvedIssue, 'id' | 'createdAt' | 'updatedAt'>): Promise<SolvedIssue> {
    const id = 'SOLVED-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    
    const fullIssue: SolvedIssue = {
      ...issue,
      id,
      createdAt: now,
      updatedAt: now
    };

    await this.fileStore.writeJSON(`workspace/projects/${projectId}/knowledge/solved/${id}.json`, fullIssue);

    if (this.obsidianBasePath) {
      const markdown = this.solvedIssueToMarkdown(fullIssue);
      // We assume obsidianBasePath is an absolute path. The FileStore currently assumes paths relative to the project root,
      // so writing to an absolute external path requires a direct 'fs' write, or we would need FileStore to support absolute paths.
      // Based on the spec: "If obsidianBasePath is set, also write a markdown version". 
      // We will construct the absolute path and use FileStore's writeMarkdown. FileStore currently requires paths relative to the app root.
      // We'll write it relative to the given base path. Note: FileStore implementation in Phase 1 accepts absolute paths too if handled carefully.
      const mdPath = path.join(this.obsidianBasePath, projectId, 'solved', `${id}.md`);
      
      // Since FileStore's writeMarkdown resolves paths relative to cwd or root, we need to bypass FileStore for absolute paths 
      // or ensure FileStore handles absolute paths correctly. For now we use the required methods from file-store.
      import('fs/promises').then(fs => {
         fs.mkdir(path.dirname(mdPath), { recursive: true }).then(() => {
           fs.writeFile(mdPath, markdown, 'utf-8');
         });
      });
    }

    return fullIssue;
  }

  async listCheatSheets(projectId: string): Promise<CheatSheet[]> {
    try {
      const files = await this.fileStore.listFiles(`workspace/projects/${projectId}/knowledge/cheat-sheets`);
      const sheets: CheatSheet[] = [];
      
      for (const fileName of files) {
        if (fileName.endsWith('.json')) {
          try {
            const sheet = await this.fileStore.readJSON<CheatSheet>(`workspace/projects/${projectId}/knowledge/cheat-sheets/${fileName}`);
            if (sheet) sheets.push(sheet);
          } catch {
            // Ignore parse errors
          }
        }
      }
      return sheets;
    } catch {
      return [];
    }
  }

  private solvedIssueToMarkdown(issue: SolvedIssue): string {
    const tagsStr = (issue.tags || []).join(', ');
    const filesStr = (issue.filesChanged || []).map(f => `- ${f}`).join('\n');
    
    return `---
title: ${issue.title}
tags: [${tagsStr}]
globalKey: ${issue.globalKey || ''}
created: ${issue.createdAt}
---
# ${issue.title}
## Symptom
${issue.symptom}
## Root Cause
${issue.rootCause}
## Fix
${issue.fixSummary}
## Files Changed
${filesStr}
## Reusable Pattern
${issue.reusablePattern || ''}
`;
  }

  private async readKnowledgeDocFile(
    projectId: string,
    absoluteFilePath: string,
    relativePath: string,
  ): Promise<SourceDocument | null> {
    try {
      const stat = await fs.stat(absoluteFilePath);
      const normalizedRelativePath = relativePath.replace(/\\/g, '/');
      const docId = normalizedRelativePath.replace(/\.(json|md)$/i, '');

      if (normalizedRelativePath.toLowerCase().endsWith('.json')) {
        // Special-case large snapshot files — show as a stub card without loading content
        const fileName = path.basename(absoluteFilePath);
        if (fileName === 'FULL_REPO_CONTEXT.json') {
          const sizeKB = Math.round(stat.size / 1024);
          return {
            id: docId,
            projectId,
            path: normalizedRelativePath,
            title: 'Full Repo Context',
            category: 'repo-context',
            trustLevel: 'derived' as const,
            watchFiles: [],
            lastReviewedAt: stat.mtime.toISOString(),
            lastUpdatedAt: stat.mtime.toISOString(),
            staleFlag: false,
            conflictFlag: false,
            conflictsWith: [],
            linkedRunIds: [],
            notes: `[Repo context snapshot — ${sizeKB} KB. Open folder to inspect.]`,
          };
        }
        const content = await fs.readFile(absoluteFilePath, 'utf-8');
        return {
          ...(JSON.parse(content) as SourceDocument),
          id: docId,
          path: normalizedRelativePath,
          lastUpdatedAt: stat.mtime.toISOString(),
        };
      }

      const content = await fs.readFile(absoluteFilePath, 'utf-8');
      const baseName = path.basename(normalizedRelativePath, '.md');
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch?.[1]?.trim() || baseName;

      return {
        id: docId,
        projectId,
        path: normalizedRelativePath,
        title,
        category: 'bootstrap',
        trustLevel: 'derived',
        watchFiles: [],
        lastReviewedAt: stat.mtime.toISOString(),
        lastUpdatedAt: stat.mtime.toISOString(),
        staleFlag: false,
        conflictFlag: false,
        conflictsWith: [],
        linkedRunIds: [],
        notes: content,
      };
    } catch (err) {
      console.error('[KnowledgeService] readKnowledgeDocFile ERROR for:', absoluteFilePath, err);
      return null;
    }
  }

  private async writeKnowledgeDoc(projectId: string, fileName: string, content: SourceDocument): Promise<void> {
    const repoDocsRoot = await this.resolveRepoKnowledgeRoot(projectId);
    const absolutePath = path.join(repoDocsRoot.absolutePath, fileName);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, JSON.stringify(content, null, 2), 'utf-8');

    const workspaceAbsolutePath = this.fileStore.resolvePath(`workspace/projects/${projectId}/knowledge/docs/${fileName}`);
    await fs.mkdir(path.dirname(workspaceAbsolutePath), { recursive: true });
    await fs.writeFile(workspaceAbsolutePath, JSON.stringify(content, null, 2), 'utf-8');
  }

  private async resolveRepoKnowledgeRoot(projectId: string): Promise<{ absolutePath: string; pathLabel: string }> {
    const project = await this.projectService.getProject(projectId);

    if (!project?.activeRepoId) {
      throw new Error(`No selected repository is set for project ${projectId}`);
    }

    const repos = await this.projectService.listRepos(projectId);
    const repo = repos.find((candidate) => candidate.id === project.activeRepoId);
    if (!repo?.localPath?.trim()) {
      throw new Error(`Selected repository path is missing for project ${projectId}`);
    }

    const absolutePath = path.join(repo.localPath.trim(), 'knowledge');
    return {
      absolutePath,
      pathLabel: absolutePath,
    };
  }

  private async walkKnowledgeFiles(rootPath: string): Promise<Array<{ absolutePath: string; relativePath: string }>> {
    const results: Array<{ absolutePath: string; relativePath: string }> = [];

    const visit = async (currentPath: string): Promise<void> => {
      let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
      try {
        entries = (await fs.readdir(currentPath, { withFileTypes: true })) as Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
      } catch {
        return;
      }

      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const absolutePath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          await visit(absolutePath);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        const relativePath = path.relative(rootPath, absolutePath).replace(/\\/g, '/');
        if (relativePath.endsWith('.md') || relativePath.endsWith('.json')) {
          results.push({ absolutePath, relativePath });
        }
      }
    };

    await visit(rootPath);
    return results;
  }
}
