import { EntityId, ISODateString } from './common.types';

/** Decision-anchor outcome classification. */
export type AnchorStatus =
  | 'Solved'
  | 'Broken'
  | 'Unsolved'
  | 'BugPatch'
  | 'Update'
  | 'DifficultProblemWithSolution';

/** Decision anchor recorded at a task or session boundary. */
export interface DecisionAnchor {
  id: EntityId;
  taskId: EntityId;
  sessionId: EntityId | null;
  status: AnchorStatus;
  summary: string;
  filesInPlay: string[];
  createdAt: ISODateString;
}

/** Input payload for creating a decision anchor. */
export interface CreateAnchorInput {
  taskId: EntityId;
  sessionId?: EntityId | null;
  status: AnchorStatus;
  summary: string;
  filesInPlay: string[];
}
