import { FileStore } from '../storage/file-store';
import { ConflictRecord, CreateConflictInput, ConflictResolution } from '../types';
import * as crypto from 'crypto';

export class ConflictService {
  private fileStore: FileStore;

  constructor(fileStore: FileStore) {
    this.fileStore = fileStore;
  }

  async createConflict(input: CreateConflictInput): Promise<ConflictRecord> {
    const id = 'CONFLICT-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    const conflict: ConflictRecord = {
      id,
      projectId: input.projectId,
      docIdA: input.docIdA,
      docIdB: input.docIdB,
      description: input.description,
      recommendation: input.recommendation,
      resolution: null,
      resolvedAt: null,
      createdAt: now
    };

    await this.fileStore.writeJSON(`workspace/projects/${input.projectId}/conflicts/${id}.json`, conflict);
    return conflict;
  }

  async listConflicts(projectId: string): Promise<ConflictRecord[]> {
    try {
      const files = await this.fileStore.listFiles(`workspace/projects/${projectId}/conflicts`);
      const conflicts: ConflictRecord[] = [];

      for (const fileName of files) {
        if (fileName.endsWith('.json')) {
          try {
            const conflict = await this.fileStore.readJSON<ConflictRecord>(`workspace/projects/${projectId}/conflicts/${fileName}`);
            if (conflict) conflicts.push(conflict);
          } catch {
            // Ignore parse errors
          }
        }
      }
      return conflicts;
    } catch {
      return [];
    }
  }

  async listUnresolved(projectId: string): Promise<ConflictRecord[]> {
    const conflicts = await this.listConflicts(projectId);
    return conflicts.filter(c => c.resolution === null);
  }

  async resolveConflict(projectId: string, conflictId: string, resolution: ConflictResolution): Promise<ConflictRecord> {
    const conflict = await this.getConflict(projectId, conflictId);
    if (!conflict) {
      throw new Error(`Conflict with ID ${conflictId} not found in project ${projectId}`);
    }

    conflict.resolution = resolution;
    conflict.resolvedAt = new Date().toISOString();

    await this.fileStore.writeJSON(`workspace/projects/${projectId}/conflicts/${conflictId}.json`, conflict);
    return conflict;
  }

  async getConflict(projectId: string, conflictId: string): Promise<ConflictRecord | null> {
    try {
      return await this.fileStore.readJSON<ConflictRecord>(`workspace/projects/${projectId}/conflicts/${conflictId}.json`);
    } catch {
      return null;
    }
  }
}
