import { EntityId, ISODateString } from './common.types';

/** Supported conflict-resolution actions. */
export type ConflictResolution = 'acceptA' | 'acceptB' | 'manualMerge';

/** Record describing a detected knowledge conflict. */
export interface ConflictRecord {
  id: EntityId;
  projectId: EntityId;
  docIdA: EntityId;
  docIdB: EntityId;
  description: string;
  recommendation: string;
  resolution: ConflictResolution | null;
  resolvedAt: ISODateString | null;
  createdAt: ISODateString;
}

/** Input payload for creating a conflict record. */
export interface CreateConflictInput {
  projectId: EntityId;
  docIdA: EntityId;
  docIdB: EntityId;
  description: string;
  recommendation: string;
}
