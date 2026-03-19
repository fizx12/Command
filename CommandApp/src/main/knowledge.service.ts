import { FileStore } from '../storage/file-store';
import { SourceDocument, CheatSheet, SolvedIssue, TrustLevel } from '../types';
import * as crypto from 'crypto';
import * as path from 'path';

export class KnowledgeService {
  private fileStore: FileStore;
  private obsidianBasePath?: string;

  constructor(fileStore: FileStore, obsidianBasePath?: string) {
    this.fileStore = fileStore;
    this.obsidianBasePath = obsidianBasePath;
  }

  async listDocs(projectId: string): Promise<SourceDocument[]> {
    try {
      const files = await this.fileStore.listFiles(`workspace/projects/${projectId}/knowledge/docs`);
      const docs: SourceDocument[] = [];
      
      for (const file of files) {
        if (file.name.endsWith('.json')) {
          try {
            const doc = await this.fileStore.readJson<SourceDocument>(`workspace/projects/${projectId}/knowledge/docs/${file.name}`);
            if (doc) docs.push(doc);
          } catch {
            // Ignore parse errors for individual docs
          }
        }
      }
      return docs;
    } catch {
      return [];
    }
  }

  async getDoc(projectId: string, docId: string): Promise<SourceDocument | null> {
    try {
      return await this.fileStore.readJson<SourceDocument>(`workspace/projects/${projectId}/knowledge/docs/${docId}.json`);
    } catch {
      return null;
    }
  }

  async createDoc(projectId: string, doc: Omit<SourceDocument, 'id'>): Promise<SourceDocument> {
    const id = 'doc-' + crypto.randomUUID().slice(0, 8);
    const fullDoc: SourceDocument = { ...doc, id };
    
    await this.fileStore.writeJson(`workspace/projects/${projectId}/knowledge/docs/${id}.json`, fullDoc);
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

    await this.fileStore.writeJson(`workspace/projects/${projectId}/knowledge/docs/${docId}.json`, updated);
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
      
      for (const file of files) {
        if (file.name.endsWith('.json')) {
          try {
            const issue = await this.fileStore.readJson<SolvedIssue>(`workspace/projects/${projectId}/knowledge/solved/${file.name}`);
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

    await this.fileStore.writeJson(`workspace/projects/${projectId}/knowledge/solved/${id}.json`, fullIssue);

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
      
      for (const file of files) {
        if (file.name.endsWith('.json')) {
          try {
            const sheet = await this.fileStore.readJson<CheatSheet>(`workspace/projects/${projectId}/knowledge/cheat-sheets/${file.name}`);
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
}
