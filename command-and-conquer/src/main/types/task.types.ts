import { EntityId, ISODateString } from './common.types';

/** Task sizing categories. */
export type TaskSize = 'Micro' | 'Standard' | 'Major';

/** Task lifecycle statuses. */
export enum TaskStatus {
  Backlog = 'backlog',
  Active = 'active',
  Blocked = 'blocked',
  Review = 'review',
  Approved = 'approved',
  Done = 'done',
  Archived = 'archived',
}

/** Task record scoped to a single active repository. */
export interface Task {
  id: EntityId;
  projectId: EntityId;
  activeRepoId: EntityId;
  title: string;
  description: string;
  size: TaskSize;
  status: TaskStatus;
  resolution: string;
  priority: number;
  scope: string;
  outOfScope: string;
  mustPreserve: string[];
  activePhase: string;
  linkedRunIds: EntityId[];
  linkedDocIds: EntityId[];
  decisionAnchorId: EntityId | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Input payload for creating a task. */
export interface CreateTaskInput {
  projectId: EntityId;
  activeRepoId: EntityId;
  title: string;
  description: string;
  size: TaskSize;
  priority: number;
  scope: string;
  outOfScope: string;
  mustPreserve: string[];
  linkedDocIds?: EntityId[];
}

/** Input payload for updating a task. */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  size?: TaskSize;
  status?: TaskStatus;
  resolution?: string;
  priority?: number;
  scope?: string;
  outOfScope?: string;
  mustPreserve?: string[];
  activePhase?: string;
  linkedRunIds?: EntityId[];
  linkedDocIds?: EntityId[];
  decisionAnchorId?: EntityId | null;
}
