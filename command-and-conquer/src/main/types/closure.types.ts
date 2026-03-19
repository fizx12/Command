import { EntityId, ISODateString } from './common.types';
import { TaskSize } from './task.types';

/** Closure record created when a task is completed or formally stopped. */
export interface ClosureRecord {
  id: EntityId;
  taskId: EntityId;
  taskSize: TaskSize;
  statusAtClose: 'done' | 'archived' | 'blocked';
  resolution: string;
  solvedSummary: string;
  remainingGaps: string[];
  followupTaskIds: EntityId[];
  sourceDocsUpdated: boolean;
  solvedIssueCreated: boolean;
  decisionAnchorId: EntityId;
  createdAt: ISODateString;
}

/** Input payload for creating a closure record. */
export interface CreateClosureInput {
  taskId: EntityId;
  taskSize: TaskSize;
  statusAtClose: 'done' | 'archived' | 'blocked';
  resolution: string;
  solvedSummary: string;
  remainingGaps: string[];
  followupTaskIds: EntityId[];
  sourceDocsUpdated: boolean;
  solvedIssueCreated: boolean;
  decisionAnchorId: EntityId;
}
