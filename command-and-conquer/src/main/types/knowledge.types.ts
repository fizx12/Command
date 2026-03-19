import { EntityId, ISODateString } from './common.types';

/** Trust classification for knowledge documents. */
export type TrustLevel =
  | 'authoritative'
  | 'derived'
  | 'stale'
  | 'conflicting'
  | 'legacy-but-live'
  | 'unclear';

/** Source knowledge document tracked by the system. */
export interface SourceDocument {
  id: EntityId;
  projectId: EntityId;
  path: string;
  title: string;
  category: string;
  trustLevel: TrustLevel;
  watchFiles: string[];
  lastReviewedAt: ISODateString;
  lastUpdatedAt: ISODateString;
  staleFlag: boolean;
  conflictFlag: boolean;
  conflictsWith: EntityId[];
  linkedRunIds: EntityId[];
  notes: string;
}

/** Condensed operational cheat sheet derived from source docs. */
export interface CheatSheet {
  id: EntityId;
  projectId: EntityId;
  domain: string;
  path: string;
  summary: string;
  sourceDocIds: EntityId[];
  watchFiles: string[];
  staleFlag: boolean;
  lastUpdatedAt: ISODateString;
}

/** Reusable solved issue record for local and cross-project learning. */
export interface SolvedIssue {
  id: EntityId;
  projectId: EntityId;
  globalKey: string;
  title: string;
  symptom: string;
  rootCause: string;
  fixSummary: string;
  filesChanged: string[];
  invariantsPreserved: string[];
  regressionNotes: string[];
  reusablePattern: string;
  linkedRunIds: EntityId[];
  tags: string[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
