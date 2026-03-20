import { EntityId, ISODateString, RiskLevel, ChangeType } from './common.types';

/** Run lifecycle statuses. */
export type RunStatus = 'importing' | 'imported' | 'review' | 'approved' | 'rejected';

export type RunTimelineEventType =
  | 'imported'
  | 'prompt_compiled'
  | 'prompt_tightened'
  | 'sent_to_agent'
  | 'evaluated'
  | 'status_changed'
  | 'revision_started'
  | 'knowledge_updated'
  | 'note';

export interface RunTimelineEntry {
  id: string;
  timestamp: string; // ISO
  type: RunTimelineEventType;
  title: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

/** Imported coder run record. */
export interface Run {
  id: EntityId;
  projectId: EntityId;
  taskId: EntityId;
  activeRepoId: EntityId;
  agentId: EntityId;
  tool: string;
  model: string;
  mode: 'MAX' | 'WeakSAUCE';
  promptPath: string;
  artifactPaths: string[];
  status: RunStatus;
  summary: string;
  risks: RunRisk[];
  validation: RunValidation[];
  changedFiles: RunChangedFile[];
  commitHash: string | null;
  knowledgeDocsUpdated?: string[]; // docs promoted from knowledge_updates/ on import
  timeline?: RunTimelineEntry[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Risk entry associated with a run. */
export interface RunRisk {
  description: string;
  severity: RiskLevel;
  mitigation: string;
}

/** Validation result associated with a run. */
export interface RunValidation {
  check: string;
  result: 'passed' | 'failed' | 'skipped' | 'uncertain';
  notes: string;
}

/** File change record associated with a run. */
export interface RunChangedFile {
  path: string;
  changeType: ChangeType;
  purpose: string;
  riskLevel: RiskLevel;
}

/** Schema for job_result.json as imported from coder. */
export interface JobResult {
  job_id: string;
  tool: string;
  model: string;
  status: 'success' | 'partial' | 'failed';
  task_title: string;
  scope: string;
  files_inspected: string[];
  files_changed: string[];
  summary: string;
  risks: { description: string; severity: string; mitigation?: string }[];
  manual_validation: { check: string; result: string; notes?: string }[];
  remaining_gaps: string[];
  commit_hash: string | null;
  planned_actions?: { action: string; status: 'completed' | 'skipped' | 'failed'; reason?: string }[];
}

/** Schema for changed_files.json as imported from coder. */
export interface ImportedChangedFile {
  path: string;
  change_type: string;
  purpose: string;
  risk_level: string;
}

/** Schema for review_checklist.json as imported from coder. */
export interface ImportedReviewChecklist {
  checks_run: { check: string; passed: boolean; notes?: string }[];
  checks_skipped: { check: string; reason: string }[];
  unresolved_items: { item: string; severity: string; notes?: string }[];
}
