# Data Model

## 1. Project
- id
- name
- description
- repoLinks[] (references Repository[])
- activeRepoId (single selection from repoLinks — the repo currently being worked in)
- preferredTool
- preferredModels
- invariants[]
- activeDocs[]
- obsidianVaultPath (path to Obsidian vault knowledge folder for this project)
- operationalPath (path to local operational folder for this project)
- healthBadge (computed: green / yellow / red — see 02_SCREEN_MAP for logic)
- createdAt
- updatedAt

## 2. Repository
- id
- projectId
- localPath
- remoteUrl
- defaultBranch
- provider
- notes

## 3. AgentDefinition
- id
- name
- role
- mode (MAX or WeakSAUCE)
- purpose
- systemPrompt
- requiredInputs[]
- outputFormat
- checklist[]
- preferredModel
- allowedActions[]
- active

## 4. PromptProfile
- id
- projectId
- name
- mode
- includedDocs[]
- includedCheatSheets[]
- outputTemplate
- artifactTailEnabled (boolean, default true — appends artifact write instructions)
- notes

## 5. Task
- id
- projectId
- activeRepoId (single repo from project's repoLinks — scopes all run artifacts)
- title
- description
- size (Micro / Standard / Major)
- status (backlog / active / blocked / review / approved / done / archived)
- resolution
- priority
- scope
- outOfScope
- mustPreserve[]
- activePhase
- linkedRunIds[]
- linkedDocIds[]
- decisionAnchorId (references DecisionAnchor, set at closure)
- createdAt
- updatedAt

### Task size definitions
- **Micro**: single-file fix, typo, config change, < 30 min expected. Closure: status picker only.
- **Standard**: multi-file feature, bug fix, refactor, 30 min – half day. Closure: AI-drafted, user confirms.
- **Major**: architecture change, migration, cross-system work, > half day. Closure: AI-drafted full closure with gap analysis.

## 6. Run
- id
- projectId
- taskId
- activeRepoId
- agentId
- tool
- model
- mode
- promptPath
- artifactPaths[]
- status
- summary
- risks[]
- validation[]
- changedFiles[]
- commitHash
- createdAt
- updatedAt

## 7. SourceDocument
- id
- projectId
- path
- title
- category
- trustLevel (authoritative / derived / stale / conflicting / legacy-but-live / unclear)
- watchFiles[] (declared in frontmatter — files this doc covers; used for auto-stale detection)
- lastReviewedAt
- lastUpdatedAt
- staleFlag (boolean — set automatically when watchFiles overlap with a run's changedFiles)
- conflictFlag (boolean — set automatically when content conflicts detected)
- conflictsWith[] (references other SourceDocument ids)
- linkedRunIds[]
- notes

## 8. CheatSheet
- id
- projectId
- domain
- path
- summary
- sourceDocIds[]
- watchFiles[] (inherited from source docs or declared directly)
- staleFlag
- lastUpdatedAt

## 9. SolvedIssue
- id
- projectId
- globalKey (for cross-project reuse)
- title
- symptom
- rootCause
- fixSummary
- filesChanged[]
- invariantsPreserved[]
- regressionNotes[]
- reusablePattern
- linkedRunIds[]
- tags[]
- createdAt
- updatedAt

Stored in both: JSON in operational folder + markdown copy in Obsidian vault.

## 10. DecisionRecord
- id
- projectId
- title
- decision
- rationale
- alternativesRejected[]
- impact
- linkedTaskId
- linkedRunId
- createdAt

Stored in both: JSON in operational folder + markdown copy in Obsidian vault.

## 11. DecisionAnchor
- id
- taskId
- sessionId (optional — links to conversation if applicable)
- status (Solved / Broken / Unsolved / BugPatch / Update / DifficultProblemWithSolution)
- summary (AI-drafted one-liner, user-confirmed)
- filesInPlay[] (auto-populated from run artifacts)
- createdAt

Created at session/task boundaries. Hard block — cannot proceed without one. AI drafts summary from run artifacts, user confirms or edits.

Stored in both: JSON in task folder + markdown copy in Obsidian vault.

## 12. ClosureRecord
- id
- taskId
- taskSize (Micro / Standard / Major)
- statusAtClose
- resolution
- solvedSummary (AI-drafted for Standard/Major, auto-generated for Micro)
- remainingGaps[]
- followupTaskIds[]
- sourceDocsUpdated (boolean)
- solvedIssueCreated (boolean)
- decisionAnchorId
- createdAt

## 13. ConflictRecord
- id
- projectId
- docIdA (references SourceDocument)
- docIdB (references SourceDocument)
- description (AI-generated summary of the conflict)
- recommendation (AI-generated)
- resolution (acceptA / acceptB / manualMerge / null if unresolved)
- resolvedAt
- createdAt

Auto-created when importer or Truth Maintainer detects conflicting docs.
