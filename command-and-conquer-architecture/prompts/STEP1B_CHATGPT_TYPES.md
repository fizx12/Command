# STEP 1B — PASTE THIS INTO ChatGPT 5.4 (runs in parallel with Step 1A)

## ⚠️ FIRST: Paste the contents of CONTEXT_BUNDLE.md above this line before sending.

You are writing TypeScript type definitions for Command and Conquer. The context bundle above describes the full system — read it to understand what this app does, how it's structured, and where these type files fit.

These types define every data entity in the system. 9 service files, 7 IPC handlers, 5 hooks, 19 components, and 10 pages will all import from these types. They must be exact.

## YOUR JOB

Write 10 TypeScript type files. Each file exports interfaces and enums for one domain. Use TypeScript strict mode. Export everything.

## RULES

1. Every field listed below MUST appear in the interface — do not skip any.
2. Do not add fields not listed. No `metadata`, no `extras`, no optional convenience fields.
3. Use `string` for IDs (not number, not uuid type).
4. Use ISO 8601 strings for all dates (`string` type with JSDoc noting format).
5. Use union types for enums where there are < 6 options, `enum` for more.
6. Every interface and enum gets a JSDoc one-liner.
7. Do not import from external packages. These are pure type files.
8. Use `export interface` not `export type` for object shapes.

## OUTPUT FORMAT

For each file:
```
=== FILE: {path} ===
```
Then the complete file contents.

---

### T1: `src/main/types/common.types.ts`

Shared types used across all domains:

```typescript
/** ISO 8601 date string */
export type ISODateString = string;

/** Entity ID (unique string identifier) */
export type EntityId = string;

/** Health badge status for projects */
export type HealthBadge = 'green' | 'yellow' | 'red';

/** Risk severity levels */
export type RiskLevel = 'low' | 'medium' | 'high';

/** File change types */
export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed';
```

---

### T2: `src/main/types/project.types.ts`

```typescript
import { EntityId, ISODateString, HealthBadge } from './common.types';

export interface Project {
  id: EntityId;
  name: string;
  description: string;
  repoLinks: EntityId[];          // references Repository.id[]
  activeRepoId: EntityId | null;  // currently active repo
  preferredTool: string;          // e.g. 'cursor', 'claude-code', 'antigravity'
  preferredModels: string[];      // e.g. ['claude-sonnet-4', 'gemini-flash']
  invariants: string[];           // must-not-break rules
  activeDocs: EntityId[];         // references SourceDocument.id[]
  obsidianVaultPath: string;      // path to Obsidian vault knowledge folder
  operationalPath: string;        // path to local operational folder
  healthBadge: HealthBadge;       // computed
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Repository {
  id: EntityId;
  projectId: EntityId;
  localPath: string;
  remoteUrl: string;
  defaultBranch: string;
  provider: string;               // e.g. 'github', 'gitlab', 'local'
  notes: string;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  preferredTool: string;
  preferredModels: string[];
  obsidianVaultPath: string;
  operationalPath: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  activeRepoId?: EntityId | null;
  preferredTool?: string;
  preferredModels?: string[];
  invariants?: string[];
  obsidianVaultPath?: string;
  operationalPath?: string;
}

export interface CreateRepoInput {
  projectId: EntityId;
  localPath: string;
  remoteUrl: string;
  defaultBranch: string;
  provider: string;
  notes: string;
}
```

---

### T3: `src/main/types/task.types.ts`

```typescript
import { EntityId, ISODateString } from './common.types';

export type TaskSize = 'Micro' | 'Standard' | 'Major';

export type TaskStatus = 'backlog' | 'active' | 'blocked' | 'review' | 'approved' | 'done' | 'archived';

export interface Task {
  id: EntityId;
  projectId: EntityId;
  activeRepoId: EntityId;         // single repo this task is scoped to
  title: string;
  description: string;
  size: TaskSize;
  status: TaskStatus;
  resolution: string;
  priority: number;               // 1 = highest
  scope: string;
  outOfScope: string;
  mustPreserve: string[];         // invariants for this task
  activePhase: string;            // current workflow phase
  linkedRunIds: EntityId[];
  linkedDocIds: EntityId[];
  decisionAnchorId: EntityId | null;  // set at closure
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

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
}

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
```

---

### T4: `src/main/types/run.types.ts`

```typescript
import { EntityId, ISODateString, RiskLevel, ChangeType } from './common.types';

export type RunStatus = 'importing' | 'imported' | 'review' | 'approved' | 'rejected';

export interface Run {
  id: EntityId;
  projectId: EntityId;
  taskId: EntityId;
  activeRepoId: EntityId;
  agentId: EntityId;
  tool: string;                   // which coder tool was used
  model: string;                  // which model was used
  mode: 'MAX' | 'WeakSAUCE';
  promptPath: string;             // path to compiled prompt that was sent
  artifactPaths: string[];        // paths to all artifact files
  status: RunStatus;
  summary: string;
  risks: RunRisk[];
  validation: RunValidation[];
  changedFiles: RunChangedFile[];
  commitHash: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface RunRisk {
  description: string;
  severity: RiskLevel;
  mitigation: string;
}

export interface RunValidation {
  check: string;
  result: 'passed' | 'failed' | 'skipped' | 'uncertain';
  notes: string;
}

export interface RunChangedFile {
  path: string;
  changeType: ChangeType;
  purpose: string;
  riskLevel: RiskLevel;
}

/** Schema for job_result.json as imported from coder */
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
}

/** Schema for changed_files.json as imported from coder */
export interface ImportedChangedFile {
  path: string;
  change_type: string;
  purpose: string;
  risk_level: string;
}

/** Schema for review_checklist.json as imported from coder */
export interface ImportedReviewChecklist {
  checks_run: { check: string; passed: boolean; notes?: string }[];
  checks_skipped: { check: string; reason: string }[];
  unresolved_items: { item: string; severity: string; notes?: string }[];
}
```

---

### T5: `src/main/types/knowledge.types.ts`

```typescript
import { EntityId, ISODateString } from './common.types';

export type TrustLevel = 'authoritative' | 'derived' | 'stale' | 'conflicting' | 'legacy-but-live' | 'unclear';

export interface SourceDocument {
  id: EntityId;
  projectId: EntityId;
  path: string;                    // file path relative to knowledge folder
  title: string;
  category: string;                // e.g. 'architecture', 'mechanics', 'contracts'
  trustLevel: TrustLevel;
  watchFiles: string[];            // glob patterns declared in frontmatter
  lastReviewedAt: ISODateString;
  lastUpdatedAt: ISODateString;
  staleFlag: boolean;              // auto-set when watchFiles overlap with run changedFiles
  conflictFlag: boolean;           // auto-set when conflict detected
  conflictsWith: EntityId[];       // other SourceDocument ids
  linkedRunIds: EntityId[];
  notes: string;
}

export interface CheatSheet {
  id: EntityId;
  projectId: EntityId;
  domain: string;
  path: string;
  summary: string;
  sourceDocIds: EntityId[];
  watchFiles: string[];            // inherited from source docs or declared directly
  staleFlag: boolean;
  lastUpdatedAt: ISODateString;
}

export interface SolvedIssue {
  id: EntityId;
  projectId: EntityId;
  globalKey: string;               // for cross-project reuse
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
```

---

### T6: `src/main/types/agent.types.ts`

```typescript
import { EntityId } from './common.types';

export type AgentMode = 'MAX' | 'WeakSAUCE';

export interface AgentDefinition {
  id: EntityId;
  name: string;
  role: string;                    // e.g. 'auditor', 'planner', 'implementer', 'reviewer'
  mode: AgentMode;
  purpose: string;
  systemPrompt: string;
  requiredInputs: string[];
  outputFormat: string;
  checklist: string[];
  preferredModel: string;
  allowedActions: string[];
  active: boolean;
}
```

---

### T7: `src/main/types/anchor.types.ts`

```typescript
import { EntityId, ISODateString } from './common.types';

export type AnchorStatus =
  | 'Solved'
  | 'Broken'
  | 'Unsolved'
  | 'BugPatch'
  | 'Update'
  | 'DifficultProblemWithSolution';

export interface DecisionAnchor {
  id: EntityId;
  taskId: EntityId;
  sessionId: EntityId | null;      // links to conversation if applicable
  status: AnchorStatus;
  summary: string;                 // AI-drafted one-liner, user-confirmed
  filesInPlay: string[];           // auto-populated from run artifacts
  createdAt: ISODateString;
}

export interface CreateAnchorInput {
  taskId: EntityId;
  sessionId?: EntityId | null;
  status: AnchorStatus;
  summary: string;
  filesInPlay: string[];
}
```

---

### T8: `src/main/types/closure.types.ts`

```typescript
import { EntityId, ISODateString } from './common.types';
import { TaskSize } from './task.types';

export interface ClosureRecord {
  id: EntityId;
  taskId: EntityId;
  taskSize: TaskSize;
  statusAtClose: 'done' | 'archived' | 'blocked';
  resolution: string;
  solvedSummary: string;           // AI-drafted for Standard/Major, auto for Micro
  remainingGaps: string[];
  followupTaskIds: EntityId[];
  sourceDocsUpdated: boolean;
  solvedIssueCreated: boolean;
  decisionAnchorId: EntityId;
  createdAt: ISODateString;
}

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
```

---

### T9: `src/main/types/conflict.types.ts`

```typescript
import { EntityId, ISODateString } from './common.types';

export type ConflictResolution = 'acceptA' | 'acceptB' | 'manualMerge';

export interface ConflictRecord {
  id: EntityId;
  projectId: EntityId;
  docIdA: EntityId;                // first conflicting document
  docIdB: EntityId;                // second conflicting document
  description: string;             // AI-generated summary
  recommendation: string;          // AI-generated resolution suggestion
  resolution: ConflictResolution | null;  // null if unresolved
  resolvedAt: ISODateString | null;
  createdAt: ISODateString;
}

export interface CreateConflictInput {
  projectId: EntityId;
  docIdA: EntityId;
  docIdB: EntityId;
  description: string;
  recommendation: string;
}
```

---

### T10: `src/main/types/prompt.types.ts`

```typescript
import { EntityId } from './common.types';
import { AgentMode } from './agent.types';

export interface PromptProfile {
  id: EntityId;
  projectId: EntityId;
  name: string;
  mode: AgentMode;
  includedDocs: EntityId[];
  includedCheatSheets: EntityId[];
  outputTemplate: string;
  artifactTailEnabled: boolean;    // default true
  notes: string;
}

/** Represents the ordered stack of prompt sections */
export interface PromptStack {
  globalRules: string;
  masterPromptShell: string;
  projectPrimer: string;
  sourceOfTruthIndex: string;
  selectedCheatSheets: string[];
  taskSpec: string;
  plannerOutput: string;
  carryForwardNotes: string;
  decisionAnchorContext: string;   // previous work context
  roleInstructions: string;
  outputFormat: string;
  artifactTail: string;           // mandatory artifact write instructions
}

/** The compiled output ready to send to a coder */
export interface CompiledPrompt {
  id: EntityId;
  projectId: EntityId;
  taskId: EntityId;
  agentId: EntityId;
  mode: AgentMode;
  compiledText: string;            // the full prompt text
  tokenEstimate: number;
  createdAt: string;
}
```

---

Also create one barrel export file:

### `src/main/types/index.ts`

Re-exports everything from all type files:

```typescript
export * from './common.types';
export * from './project.types';
export * from './task.types';
export * from './run.types';
export * from './knowledge.types';
export * from './agent.types';
export * from './anchor.types';
export * from './closure.types';
export * from './conflict.types';
export * from './prompt.types';
```
