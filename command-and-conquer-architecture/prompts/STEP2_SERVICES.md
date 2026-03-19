# STEP 2 — SERVICES (Cheap Coder — one prompt per file)

## ⚠️ For EVERY prompt below, send it as:
1. CONTEXT_BUNDLE.md (full project context)
2. ALL type files from Step 1B output (the service needs to see every interface)
3. `src/main/storage/file-store.ts` from Step 1A output (services depend on FileStore)
4. The prompt below

Run these AFTER Step 1C review passes. Each prompt below goes to a separate cheap coder session. They can run in parallel within each sub-batch but S4 depends on S3.

**Sub-batch A (parallel):** S1, S2, S3, S5
**Sub-batch B (after A):** S4 (needs S3 output — paste knowledge.service.ts along with the above), S6, S7
**Sub-batch C (after A):** S8, S9

After all 9: smart AI review checkpoint.

---

## S1: `src/main/services/project.service.ts` → Codestral

```
You are a code writer. Follow these instructions exactly. Do not add features. Do not refactor. Write exactly what is specified.

TECH STACK: TypeScript strict mode, Node.js, async/await

FILE TO CREATE: src/main/services/project.service.ts

IMPORTS:
- FileStore from '../storage/file-store'
- Project, Repository, CreateProjectInput, UpdateProjectInput, CreateRepoInput from '../types'
- crypto (Node.js built-in, for generating IDs)

CLASS: ProjectService

CONSTRUCTOR:
- Takes a FileStore instance
- Stores it as private property

METHODS:

1. async listProjects(): Promise<Project[]>
   - Read all directory names from 'workspace/projects/'
   - For each, read 'workspace/projects/{id}/overview/project.config.json'
   - Return array of Project objects

2. async getProject(id: string): Promise<Project | null>
   - Read 'workspace/projects/{id}/overview/project.config.json'
   - Return Project or null if not found

3. async createProject(input: CreateProjectInput): Promise<Project>
   - Generate ID: 'proj-' + crypto.randomUUID().slice(0, 8)
   - Create Project object with defaults: repoLinks=[], activeRepoId=null, invariants=[], activeDocs=[], healthBadge='green', createdAt/updatedAt=new Date().toISOString()
   - Ensure directory: 'workspace/projects/{id}/overview/'
   - Also ensure: 'workspace/projects/{id}/tasks/', 'workspace/projects/{id}/runs/', 'workspace/projects/{id}/agents/', 'workspace/projects/{id}/conversations/', 'workspace/projects/{id}/conflicts/'
   - Write to 'workspace/projects/{id}/overview/project.config.json'
   - Return created Project

4. async updateProject(id: string, input: UpdateProjectInput): Promise<Project>
   - Read existing project
   - Merge input fields (only overwrite fields present in input)
   - Set updatedAt to now
   - Write back
   - Return updated Project

5. async deleteProject(id: string): Promise<void>
   - Remove directory 'workspace/projects/{id}/'

6. async addRepo(input: CreateRepoInput): Promise<Repository>
   - Generate ID: 'repo-' + crypto.randomUUID().slice(0, 8)
   - Create Repository object
   - Read project, push repo ID to repoLinks, write project back
   - Write repo to 'workspace/projects/{input.projectId}/overview/repos/{id}.json'
   - Return Repository

7. async listRepos(projectId: string): Promise<Repository[]>
   - List files in 'workspace/projects/{projectId}/overview/repos/'
   - Read and return each

DOES NOT:
- Access the network
- Compute health badges (that's a separate service)
- Touch knowledge/ folder
- Validate input (IPC layer handles that)

OUTPUT FORMAT: Just the complete TypeScript file contents. Nothing else.
```

---

## S2: `src/main/services/task.service.ts` → Codestral

```
You are a code writer. Follow these instructions exactly. Do not add features.

TECH STACK: TypeScript strict mode, Node.js, async/await

FILE TO CREATE: src/main/services/task.service.ts

IMPORTS:
- FileStore from '../storage/file-store'
- Task, CreateTaskInput, UpdateTaskInput, TaskStatus from '../types'
- crypto from 'crypto'

CLASS: TaskService

CONSTRUCTOR:
- Takes a FileStore instance

METHODS:

1. async listTasks(projectId: string): Promise<Task[]>
   - List directories in 'workspace/projects/{projectId}/tasks/'
   - For each, read 'task_spec.json' inside it
   - Return array of Task objects

2. async getTask(projectId: string, taskId: string): Promise<Task | null>
   - Read 'workspace/projects/{projectId}/tasks/{taskId}/task_spec.json'
   - Return Task or null

3. async createTask(projectId: string, input: CreateTaskInput): Promise<Task>
   - Generate ID: 'TASK-' + String(Date.now()).slice(-6)
   - Create Task with defaults: status='backlog', resolution='', activePhase='created', linkedRunIds=[], linkedDocIds=[], decisionAnchorId=null, createdAt/updatedAt=now
   - Ensure directory: 'workspace/projects/{projectId}/tasks/{id}/'
   - Write to 'workspace/projects/{projectId}/tasks/{id}/task_spec.json'
   - Return Task

4. async updateTask(projectId: string, taskId: string, input: UpdateTaskInput): Promise<Task>
   - Read existing task
   - Merge input fields
   - Set updatedAt to now
   - Write back
   - Return updated Task

5. async listTasksByStatus(projectId: string, status: TaskStatus): Promise<Task[]>
   - Call listTasks, filter by status
   - Return filtered array

6. async getTasksInReviewOlderThan(projectId: string, hours: number): Promise<Task[]>
   - Call listTasks
   - Filter: status === 'review' AND updatedAt older than {hours} hours ago
   - Return filtered array

DOES NOT:
- Handle closure (that's closure.service)
- Handle decision anchors
- Touch run artifacts
- Validate input

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## S3: `src/main/services/knowledge.service.ts` → Codestral

```
You are a code writer. Follow these instructions exactly.

TECH STACK: TypeScript strict mode, Node.js, async/await

FILE TO CREATE: src/main/services/knowledge.service.ts

IMPORTS:
- FileStore from '../storage/file-store'
- SourceDocument, CheatSheet, SolvedIssue, TrustLevel from '../types'
- crypto from 'crypto'
- path from 'path'

CLASS: KnowledgeService

CONSTRUCTOR:
- Takes a FileStore instance
- Takes an optional obsidianBasePath: string (for writing to Obsidian vault)

METHODS:

1. async listDocs(projectId: string): Promise<SourceDocument[]>
   - List JSON files in 'workspace/projects/{projectId}/knowledge/docs/'
   - Read and return each

2. async getDoc(projectId: string, docId: string): Promise<SourceDocument | null>
   - Read 'workspace/projects/{projectId}/knowledge/docs/{docId}.json'

3. async createDoc(projectId: string, doc: Omit<SourceDocument, 'id'>): Promise<SourceDocument>
   - Generate ID: 'doc-' + crypto.randomUUID().slice(0, 8)
   - Write to knowledge/docs/{id}.json
   - Return SourceDocument

4. async updateDoc(projectId: string, docId: string, updates: Partial<SourceDocument>): Promise<SourceDocument>
   - Read, merge, write back

5. async flagStale(projectId: string, docId: string): Promise<void>
   - Read doc, set staleFlag=true, set trustLevel='stale', write back

6. async clearStaleFlag(projectId: string, docId: string): Promise<void>
   - Read doc, set staleFlag=false, set lastReviewedAt=now, write back

7. async flagConflict(projectId: string, docIdA: string, docIdB: string): Promise<void>
   - Read both docs
   - Set conflictFlag=true on both
   - Add each to the other's conflictsWith array
   - Write both back

8. async getDocsWithWatchFileOverlap(projectId: string, changedFiles: string[]): Promise<SourceDocument[]>
   - List all docs
   - For each doc, check if any of doc.watchFiles glob patterns match any changedFiles path
   - Use simple string matching: if a watchFile ends with '/**', check if the changed file path starts with the watchFile prefix. If watchFile is an exact path, check for exact match.
   - Return docs that have overlap

9. async listSolvedIssues(projectId: string): Promise<SolvedIssue[]>
   - List JSON files in 'workspace/projects/{projectId}/knowledge/solved/'
   - Read and return each

10. async createSolvedIssue(projectId: string, issue: Omit<SolvedIssue, 'id' | 'createdAt' | 'updatedAt'>): Promise<SolvedIssue>
    - Generate ID: 'SOLVED-' + crypto.randomUUID().slice(0, 8)
    - Write to knowledge/solved/{id}.json
    - If obsidianBasePath is set, also write a markdown version to {obsidianBasePath}/{projectId}/solved/{id}.md
    - Return SolvedIssue

11. async listCheatSheets(projectId: string): Promise<CheatSheet[]>
    - List JSON files in 'workspace/projects/{projectId}/knowledge/cheat-sheets/'

HELPER METHOD for Obsidian markdown conversion:

private solvedIssueToMarkdown(issue: SolvedIssue): string
  - Return markdown with YAML frontmatter (title, tags, globalKey) and body sections for symptom, root cause, fix summary, files changed, reusable pattern

DOES NOT:
- Detect conflicts (that's the run importer's job, this just flags them)
- Modify task or run records
- Full glob matching (uses simple prefix matching for watchFiles)

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## S4: `src/main/services/run-importer.service.ts` → Codestral

```
You are a code writer. Follow these instructions exactly.

TECH STACK: TypeScript strict mode, Node.js, async/await

FILE TO CREATE: src/main/services/run-importer.service.ts

DEPENDS ON: knowledge.service.ts must exist first.

IMPORTS:
- FileStore from '../storage/file-store'
- SchemaValidator from '../storage/schema-validator'
- KnowledgeService from './knowledge.service'
- Run, JobResult, ImportedChangedFile, ImportedReviewChecklist, RunChangedFile from '../types'
- crypto from 'crypto'
- path from 'path'
- fs from 'fs/promises'

CLASS: RunImporterService

CONSTRUCTOR:
- Takes FileStore, SchemaValidator, KnowledgeService

METHODS:

1. async importRun(projectId: string, sourceFolderPath: string): Promise<{ run: Run; staleDocIds: string[] }>
   Steps:
   a. Read job_result.json from sourceFolderPath, validate against 'job_result' schema
   b. Read changed_files.json, validate against 'changed_files' schema
   c. Read review_checklist.json, validate against 'review_checklist' schema
   d. If any validation fails, throw Error with details
   e. Generate run ID: 'RUN-' + String(Date.now()).slice(-6)
   f. Create destination: 'workspace/projects/{projectId}/runs/{runId}/'
   g. Copy all files from sourceFolderPath to destination
   h. Create Run object from imported data
   i. Write Run metadata to destination as 'run.meta.json'
   j. Check for stale docs: call knowledgeService.getDocsWithWatchFileOverlap(projectId, changedFiles paths)
   k. For each overlapping doc, call knowledgeService.flagStale(projectId, docId)
   l. Return { run, staleDocIds: array of flagged doc IDs }

2. async validateArtifacts(folderPath: string): Promise<{ valid: boolean; errors: string[] }>
   - Check that job_result.json exists
   - Check that changed_files.json exists
   - Check that review_checklist.json exists
   - Check that job_summary.md exists
   - Check that code_snippets.md exists
   - Validate each JSON against its schema
   - Return validation result

3. async getRun(projectId: string, runId: string): Promise<Run | null>
   - Read 'workspace/projects/{projectId}/runs/{runId}/run.meta.json'

4. async listRuns(projectId: string): Promise<Run[]>
   - List directories in 'workspace/projects/{projectId}/runs/'
   - Read run.meta.json from each
   - Return sorted by createdAt descending

DOES NOT:
- Detect content conflicts between docs (Phase 3 feature)
- Modify tasks (the IPC layer links runs to tasks)
- Watch folders (that's watcher.service)

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## S5: `src/main/services/prompt-compiler.service.ts` → Haiku

```
You are a code writer. Follow these instructions exactly.

TECH STACK: TypeScript strict mode, Node.js, async/await

FILE TO CREATE: src/main/services/prompt-compiler.service.ts

IMPORTS:
- FileStore from '../storage/file-store'
- PromptStack, CompiledPrompt, AgentMode from '../types'
- crypto from 'crypto'

CLASS: PromptCompilerService

CONSTRUCTOR:
- Takes a FileStore instance

METHODS:

1. async compile(projectId: string, taskId: string, agentId: string, mode: AgentMode): Promise<CompiledPrompt>
   Steps:
   a. Read global rules from 'system/GLOBAL_RULES.md'
   b. Read master prompt from 'system/MASTER_PROMPT.md'
   c. Read project primer from 'workspace/projects/{projectId}/knowledge/docs/APP_PRIMER.md' (or empty string if missing)
   d. Read source of truth index from 'workspace/projects/{projectId}/knowledge/docs/SOURCE_OF_TRUTH_INDEX.md' (or empty)
   e. Read task spec from 'workspace/projects/{projectId}/tasks/{taskId}/task_spec.json', convert to markdown section
   f. Read planner output from 'workspace/projects/{projectId}/tasks/{taskId}/planner_output.md' (or empty)
   g. Read carry forward from 'workspace/projects/{projectId}/tasks/{taskId}/carry_forward.md' (or empty)
   h. Read agent definition from 'workspace/projects/{projectId}/agents/{agentId}.md' (or 'system/AGENT_LIBRARY.md')
   i. Read output format from 'system/OUTPUT_FORMAT.md'
   j. Read artifact tail from 'system/ARTIFACT_TAIL.md'
   k. If mode is 'WeakSAUCE': only include task spec, agent role, output format, and artifact tail
   l. If mode is 'MAX': include everything
   m. Concatenate all sections with markdown headers separating them
   n. Estimate tokens: Math.ceil(compiledText.length / 4)
   o. Return CompiledPrompt object

2. async preview(projectId: string, taskId: string, agentId: string, mode: AgentMode): Promise<string>
   - Call compile(), return just the compiledText string

HELPER: private taskSpecToMarkdown(task: any): string
   - Convert task JSON to readable markdown with sections for title, size, scope, out of scope, must preserve, description

DOES NOT:
- Inject decision anchor context (Phase 3)
- Select cheat sheets automatically
- Send prompts to any external tool
- Validate the prompt content

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## S6: `src/main/services/closure.service.ts` → Haiku

```
You are a code writer. Follow these instructions exactly.

TECH STACK: TypeScript strict mode, Node.js, async/await

FILE TO CREATE: src/main/services/closure.service.ts

IMPORTS:
- FileStore from '../storage/file-store'
- ClosureRecord, CreateClosureInput, TaskSize from '../types'
- crypto from 'crypto'

CLASS: ClosureService

CONSTRUCTOR:
- Takes a FileStore instance

METHODS:

1. async createClosure(projectId: string, input: CreateClosureInput): Promise<ClosureRecord>
   - Generate ID: 'CLOSE-' + crypto.randomUUID().slice(0, 8)
   - Create ClosureRecord with id and createdAt=now
   - Write to 'workspace/projects/{projectId}/tasks/{input.taskId}/closure.json'
   - Return ClosureRecord

2. async getClosure(projectId: string, taskId: string): Promise<ClosureRecord | null>
   - Read 'workspace/projects/{projectId}/tasks/{taskId}/closure.json'

3. getRequiredFields(taskSize: TaskSize): string[]
   - If Micro: return ['statusAtClose', 'resolution', 'solvedSummary', 'decisionAnchorId']
   - If Standard: return ['statusAtClose', 'resolution', 'solvedSummary', 'remainingGaps', 'sourceDocsUpdated', 'decisionAnchorId']
   - If Major: return ['statusAtClose', 'resolution', 'solvedSummary', 'remainingGaps', 'followupTaskIds', 'sourceDocsUpdated', 'solvedIssueCreated', 'decisionAnchorId']

4. validateClosure(input: CreateClosureInput): { valid: boolean; missingFields: string[] }
   - Get required fields for input.taskSize
   - Check each required field is present and non-empty (for strings) or non-null
   - Return result

DOES NOT:
- Draft closure summaries (that's the AI/UI layer)
- Create decision anchors (separate service)
- Modify task status (IPC layer does that)

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## S7: `src/main/services/conflict.service.ts` → Haiku

```
You are a code writer. Follow these instructions exactly.

TECH STACK: TypeScript strict mode, Node.js, async/await

FILE TO CREATE: src/main/services/conflict.service.ts

IMPORTS:
- FileStore from '../storage/file-store'
- ConflictRecord, CreateConflictInput, ConflictResolution from '../types'
- crypto from 'crypto'

CLASS: ConflictService

CONSTRUCTOR:
- Takes a FileStore instance

METHODS:

1. async createConflict(input: CreateConflictInput): Promise<ConflictRecord>
   - Generate ID: 'CONFLICT-' + crypto.randomUUID().slice(0, 8)
   - Create ConflictRecord with resolution=null, resolvedAt=null, createdAt=now
   - Write to 'workspace/projects/{input.projectId}/conflicts/{id}.json'
   - Return ConflictRecord

2. async listConflicts(projectId: string): Promise<ConflictRecord[]>
   - List JSON files in 'workspace/projects/{projectId}/conflicts/'
   - Read and return each

3. async listUnresolved(projectId: string): Promise<ConflictRecord[]>
   - Call listConflicts, filter where resolution === null

4. async resolveConflict(projectId: string, conflictId: string, resolution: ConflictResolution): Promise<ConflictRecord>
   - Read conflict
   - Set resolution and resolvedAt=now
   - Write back
   - Return updated

5. async getConflict(projectId: string, conflictId: string): Promise<ConflictRecord | null>
   - Read 'workspace/projects/{projectId}/conflicts/{conflictId}.json'

DOES NOT:
- Clear document conflict flags (the caller handles that via knowledge.service)
- Generate AI conflict summaries
- Detect conflicts

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## S8: `src/main/services/watcher.service.ts` → Codestral

```
You are a code writer. Follow these instructions exactly.

TECH STACK: TypeScript strict mode, Node.js, async/await, chokidar

FILE TO CREATE: src/main/services/watcher.service.ts

IMPORTS:
- chokidar from 'chokidar'
- path from 'path'
- EventEmitter from 'events'

CLASS: WatcherService extends EventEmitter

PURPOSE: Watch a folder for new run artifact folders. When a new folder appears with job_result.json inside, emit an event.

CONSTRUCTOR:
- Takes watchPath: string (the folder to watch)
- Does not start watching on construction

METHODS:

1. start(): void
   - Use chokidar.watch(this.watchPath, { depth: 2, ignoreInitial: true })
   - Listen for 'add' events
   - When a file named 'job_result.json' is added, emit event 'new-run' with the parent folder path
   - Store the watcher instance for cleanup

2. stop(): void
   - Close the chokidar watcher

3. isWatching(): boolean
   - Return whether the watcher is active

EVENTS EMITTED:
- 'new-run' with payload: { folderPath: string }

DOES NOT:
- Import runs (just detects them)
- Validate artifacts
- Access any other services

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## S9: `src/main/services/obsidian-bridge.service.ts` → Codestral

```
You are a code writer. Follow these instructions exactly.

TECH STACK: TypeScript strict mode, Node.js, async/await

FILE TO CREATE: src/main/services/obsidian-bridge.service.ts

IMPORTS:
- fs from 'fs/promises'
- path from 'path'
- SolvedIssue, DecisionAnchor, ClosureRecord from '../types'

CLASS: ObsidianBridgeService

PURPOSE: Write markdown copies of operational records to the Obsidian vault for search and backlinks. This is a ONE-WAY write bridge — it never reads from Obsidian.

CONSTRUCTOR:
- Takes vaultBasePath: string (root of the Obsidian vault's CommandAndConquer folder)

METHODS:

1. async writeSolvedIssue(projectId: string, issue: SolvedIssue): Promise<void>
   - Ensure directory: {vaultBasePath}/{projectId}/solved/
   - Write markdown file: {vaultBasePath}/{projectId}/solved/{issue.id}.md
   - Format:
     ```
     ---
     title: {issue.title}
     tags: [{issue.tags joined}]
     globalKey: {issue.globalKey}
     created: {issue.createdAt}
     ---
     # {issue.title}
     ## Symptom
     {issue.symptom}
     ## Root Cause
     {issue.rootCause}
     ## Fix
     {issue.fixSummary}
     ## Files Changed
     {bullet list of issue.filesChanged}
     ## Reusable Pattern
     {issue.reusablePattern}
     ```

2. async writeDecisionAnchor(projectId: string, anchor: DecisionAnchor): Promise<void>
   - Ensure directory: {vaultBasePath}/{projectId}/decisions/
   - Write: {vaultBasePath}/{projectId}/decisions/{anchor.id}.md
   - Format:
     ```
     ---
     title: {anchor.status} — {anchor.summary}
     task: {anchor.taskId}
     status: {anchor.status}
     created: {anchor.createdAt}
     ---
     # {anchor.status}: {anchor.summary}
     **Task:** {anchor.taskId}
     **Files:** {bullet list of anchor.filesInPlay}
     ```

3. async writeClosure(projectId: string, closure: ClosureRecord): Promise<void>
   - Ensure directory: {vaultBasePath}/{projectId}/closures/
   - Write: {vaultBasePath}/{projectId}/closures/{closure.id}.md
   - Format with YAML frontmatter and sections for resolution, summary, gaps, follow-ups

HELPER: private async ensureDir(dirPath: string): Promise<void>
   - fs.mkdir(dirPath, { recursive: true })

DOES NOT:
- Read from Obsidian vault
- Modify existing vault files
- Create Obsidian-specific metadata (no .obsidian/ files)
- Handle knowledge docs (those are managed directly in the vault)

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## STEP 2 REVIEW — PASTE THIS INTO SMART AI AFTER ALL 9 SERVICES ARE DONE

```
Review these 9 service files for an Electron app. Check:

1. Do all services use FileStore consistently (same path patterns)?
2. Do the path patterns match: 'workspace/projects/{projectId}/tasks/', 'workspace/projects/{projectId}/runs/', etc.?
3. Do all services import types from '../types' (the barrel export)?
4. Does run-importer correctly call knowledge.service.flagStale?
5. Does closure.service validation match the size-gated rules (Micro needs fewer fields)?
6. Are all IDs generated consistently (prefix + random)?
7. Any missing null checks on reads?
8. Any method that accidentally mutates input parameters?

Output: list of issues with exact fixes needed, or "SERVICES APPROVED."

{PASTE ALL 9 SERVICE FILES HERE}
```
