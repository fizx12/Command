import { FileStore } from '../storage/file-store';
import { ClosureRecord, CreateClosureInput, TaskSize } from '../types';
import * as crypto from 'crypto';

export class ClosureService {
  private fileStore: FileStore;

  constructor(fileStore: FileStore) {
    this.fileStore = fileStore;
  }

  async createClosure(projectId: string, input: CreateClosureInput): Promise<ClosureRecord> {
    const id = 'CLOSE-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    const closure: ClosureRecord = {
      id,
      taskId: input.taskId,
      taskSize: input.taskSize,
      statusAtClose: input.statusAtClose,
      resolution: input.resolution,
      solvedSummary: input.solvedSummary,
      remainingGaps: input.remainingGaps || [],
      followupTaskIds: input.followupTaskIds || [],
      sourceDocsUpdated: input.sourceDocsUpdated || false,
      solvedIssueCreated: input.solvedIssueCreated || false,
      decisionAnchorId: input.decisionAnchorId,
      createdAt: now
    };

    await this.fileStore.writeJson(`workspace/projects/${projectId}/tasks/${input.taskId}/closure.json`, closure);
    return closure;
  }

  async getClosure(projectId: string, taskId: string): Promise<ClosureRecord | null> {
    try {
      return await this.fileStore.readJson<ClosureRecord>(`workspace/projects/${projectId}/tasks/${taskId}/closure.json`);
    } catch {
      return null;
    }
  }

  getRequiredFields(taskSize: TaskSize): string[] {
    if (taskSize === 'Micro') {
      return ['statusAtClose', 'resolution', 'solvedSummary', 'decisionAnchorId'];
    } else if (taskSize === 'Standard') {
      return ['statusAtClose', 'resolution', 'solvedSummary', 'remainingGaps', 'sourceDocsUpdated', 'decisionAnchorId'];
    } else { // Major
      return ['statusAtClose', 'resolution', 'solvedSummary', 'remainingGaps', 'followupTaskIds', 'sourceDocsUpdated', 'solvedIssueCreated', 'decisionAnchorId'];
    }
  }

  validateClosure(input: CreateClosureInput): { valid: boolean; missingFields: string[] } {
    const requiredFields = this.getRequiredFields(input.taskSize);
    const missingFields: string[] = [];
    const anyInput = input as any;

    for (const field of requiredFields) {
      if (anyInput[field] === undefined || anyInput[field] === null) {
        missingFields.push(field);
      } else if (typeof anyInput[field] === 'string' && anyInput[field] === '') {
        missingFields.push(field);
      }
    }

    return {
      valid: missingFields.length === 0,
      missingFields
    };
  }
}
