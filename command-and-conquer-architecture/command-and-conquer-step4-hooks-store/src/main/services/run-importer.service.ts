import { FileStore } from '../storage/file-store';
import { SchemaValidator } from '../storage/schema-validator';
import { KnowledgeService } from './knowledge.service';
import { Run, JobResult, ImportedChangedFile, ImportedReviewChecklist, RunChangedFile } from '../types';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

export class RunImporterService {
  private fileStore: FileStore;
  private schemaValidator: SchemaValidator;
  private knowledgeService: KnowledgeService;

  constructor(fileStore: FileStore, schemaValidator: SchemaValidator, knowledgeService: KnowledgeService) {
    this.fileStore = fileStore;
    this.schemaValidator = schemaValidator;
    this.knowledgeService = knowledgeService;
  }

  async importRun(projectId: string, sourceFolderPath: string): Promise<{ run: Run; staleDocIds: string[] }> {
    const jobResultPath = path.join(sourceFolderPath, 'job_result.json');
    const changedFilesPath = path.join(sourceFolderPath, 'changed_files.json');
    const reviewChecklistPath = path.join(sourceFolderPath, 'review_checklist.json');

    const jobResultData = await fs.readFile(jobResultPath, 'utf8');
    const changedFilesData = await fs.readFile(changedFilesPath, 'utf8');
    const reviewChecklistData = await fs.readFile(reviewChecklistPath, 'utf8');

    const jobResult = JSON.parse(jobResultData) as JobResult;
    const changedFilesInfo = JSON.parse(changedFilesData) as ImportedChangedFile[];
    const reviewChecklist = JSON.parse(reviewChecklistData) as ImportedReviewChecklist;

    const jobResultValid = await this.schemaValidator.validate('job_result', jobResult);
    if (!jobResultValid.valid) throw new Error(`job_result validation failed: ${jobResultValid.errors.join(', ')}`);

    const changedFilesValid = await this.schemaValidator.validate('changed_files', changedFilesInfo);
    if (!changedFilesValid.valid) throw new Error(`changed_files validation failed: ${changedFilesValid.errors.join(', ')}`);

    const reviewChecklistValid = await this.schemaValidator.validate('review_checklist', reviewChecklist);
    if (!reviewChecklistValid.valid) throw new Error(`review_checklist validation failed: ${reviewChecklistValid.errors.join(', ')}`);

    const runId = 'RUN-' + String(Date.now()).slice(-6);
    const destFolder = `workspace/projects/${projectId}/runs/${runId}`;
    await this.fileStore.writeMarkdown(`${destFolder}/.keep`, 'Keep file to ensure dir creation');

    // copy files
    const sourceFiles = await fs.readdir(sourceFolderPath);
    for (const file of sourceFiles) {
      const srcPath = path.join(sourceFolderPath, file);
      const content = await fs.readFile(srcPath, 'utf8');
      if (file.endsWith('.json')) {
        await this.fileStore.writeJson(`${destFolder}/${file}`, JSON.parse(content));
      } else {
        await this.fileStore.writeMarkdown(`${destFolder}/${file}`, content);
      }
    }

    const now = new Date().toISOString();
    
    // Create RunChangedFile array mapping
    const structuredChangedFiles: RunChangedFile[] = changedFilesInfo.map(cf => ({
      path: cf.path,
      changeType: cf.change_type,
      purpose: cf.purpose,
      riskLevel: cf.risk_level
    }));

    const run: Run = {
      id: runId,
      projectId,
      taskId: 'UNKNOWN', // Caller will link this later
      activeRepoId: 'UNKNOWN', // Caller will link this later
      agentId: '',
      tool: jobResult.tool,
      model: jobResult.model,
      mode: 'WeakSAUCE', // Default until logic overrides
      promptPath: '',
      artifactPaths: sourceFiles.map(f => `${destFolder}/${f}`),
      status: jobResult.status as any,
      summary: jobResult.summary,
      risks: jobResult.risks,
      validation: jobResult.manual_validation,
      changedFiles: structuredChangedFiles,
      commitHash: jobResult.commit_hash,
      createdAt: now,
      updatedAt: now
    };

    await this.fileStore.writeJson(`${destFolder}/run.meta.json`, run);

    const changedFilePaths = structuredChangedFiles.map(cf => cf.path);
    const overlappingDocs = await this.knowledgeService.getDocsWithWatchFileOverlap(projectId, changedFilePaths);
    
    const staleDocIds: string[] = [];
    for (const doc of overlappingDocs) {
      await this.knowledgeService.flagStale(projectId, doc.id);
      staleDocIds.push(doc.id);
    }

    return { run, staleDocIds };
  }

  async validateArtifacts(folderPath: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const files = await fs.readdir(folderPath);

    const required = ['job_result.json', 'changed_files.json', 'review_checklist.json', 'job_summary.md', 'code_snippets.md'];
    for (const req of required) {
      if (!files.includes(req)) errors.push(`Missing required artifact: ${req}`);
    }

    if (errors.length > 0) return { valid: false, errors };

    try {
      const jobResult = JSON.parse(await fs.readFile(path.join(folderPath, 'job_result.json'), 'utf8'));
      const changedFiles = JSON.parse(await fs.readFile(path.join(folderPath, 'changed_files.json'), 'utf8'));
      const reviewChecklist = JSON.parse(await fs.readFile(path.join(folderPath, 'review_checklist.json'), 'utf8'));

      const v1 = await this.schemaValidator.validate('job_result', jobResult);
      if (!v1.valid) errors.push(`job_result.json: ${v1.errors.join(', ')}`);

      const v2 = await this.schemaValidator.validate('changed_files', changedFiles);
      if (!v2.valid) errors.push(`changed_files.json: ${v2.errors.join(', ')}`);

      const v3 = await this.schemaValidator.validate('review_checklist', reviewChecklist);
      if (!v3.valid) errors.push(`review_checklist.json: ${v3.errors.join(', ')}`);
    } catch (e: any) {
      errors.push(`Error parsing JSON: ${e.message}`);
    }

    return { valid: errors.length === 0, errors };
  }

  async getRun(projectId: string, runId: string): Promise<Run | null> {
    try {
      return await this.fileStore.readJson<Run>(`workspace/projects/${projectId}/runs/${runId}/run.meta.json`);
    } catch {
      return null;
    }
  }

  async listRuns(projectId: string): Promise<Run[]> {
    try {
      const runDirs = await this.fileStore.listDirs(`workspace/projects/${projectId}/runs`);
      const runs: Run[] = [];

      for (const dir of runDirs) {
        if (dir.isDirectory && dir.name !== '.keep') {
          try {
            const run = await this.fileStore.readJson<Run>(`workspace/projects/${projectId}/runs/${dir.name}/run.meta.json`);
            if (run) runs.push(run);
          } catch {
            // ignore
          }
        }
      }

      return runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }
}
