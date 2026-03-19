# Command & Conquer AI Orchestration App — Test Walkthrough

**Version**: 1.0  
**Last Updated**: 2026-03-17  
**App Type**: Electron + React Desktop App  

---

## Quick Sanity Checks

Before beginning any test, verify the following prerequisites:

- [ ] Electron app launches without errors
- [ ] Dashboard displays with sidebar (Projects, Tasks, Runs, Review tabs visible)
- [ ] Database/schema files exist and are initialized
- [ ] `basePath` environment variable points to workspace folder (default: `./workspace`)
- [ ] `workspace/projects/` directory exists and is readable
- [ ] React DevTools console shows no critical errors
- [ ] Project health badge colors render correctly (green, yellow, red states)
- [ ] Token counter in Prompt Builder calculates and displays values (3000–6000 range for MAX mode)

---

## Step 1: Create a Project

**Goal**: Create a new project with invariants (rules that must never break).

1. Click **Projects** in the left sidebar
2. Click **Create Project** button
3. Fill in the form:
   - **Name**: Enter a test project name (e.g., "Fishing Game Refactor")
   - **Description**: Enter a clear description (e.g., "Refactor core fishing mechanics")
   - **Invariants**: Enter comma-separated rules (e.g., "No breaking game save files, Preserve fishing rod API")
4. Click **Create** button

**Checkpoints**:
- [ ] New project appears on the dashboard
- [ ] Health badge displays in **green** (healthy state)
- [ ] Project card shows name, description, and invariant count
- [ ] Project ID is generated and visible in the URL or project details
- [ ] Clicking the project navigates to its detail page
- [ ] **Tasks** tab is available (empty initially)
- [ ] **Prompt Builder** tab is available
- [ ] **Runs** tab is available

---

## Step 2: Create a Task

**Goal**: Add a task to the project backlog with scope definitions.

1. Inside the project, click the **Tasks** tab
2. Click **Create Task** button
3. Fill in the form:
   - **Title**: e.g., "Fix diagonal fishing exploit"
   - **Description**: e.g., "Players can fish diagonally—restrict to cardinal directions only"
   - **Size**: Select one from: `Micro`, `Standard`, `Major`
   - **Scope**: e.g., "Refactor isNearWater() function, update unit tests"
   - **Out-of-Scope**: e.g., "Change fishing UI, balance catch rates, add new fish types"
   - **Must Preserve**: e.g., "Existing save file format, public API contract"
4. Click **Create** button

**Checkpoints**:
- [ ] Task appears in the **BACKLOG** column
- [ ] Task card displays title, size badge, and status (BACKLOG)
- [ ] Task ID is generated and visible
- [ ] Clicking the task opens its detail panel
- [ ] Task data persists if sidebar is toggled or page reloaded
- [ ] Description, scope, and must-preserve fields are all visible
- [ ] Task can be edited (fields update without re-saving the project)

---

## Step 3: Compile a Prompt

**Goal**: Generate a detailed AI prompt with token count and output location block.

1. Inside the project, click the **Prompt Builder** tab
2. In the **Task Selection** dropdown, select the task created in Step 2
3. In the **Agent Role** dropdown, select one of:
   - `planner_max` — Plans the entire solution
   - `implementer_max` — Writes the implementation
   - `reviewer_max` — Reviews and audits code
   - `implementer_weaksauce` — Basic implementation (fewer tokens)
4. Click **Compile & Copy** button

**Checkpoints**:
- [ ] Preview box populates with compiled prompt text
- [ ] **Token Count** displays below preview (should be ~3000–6000 for MAX mode)
- [ ] Prompt includes task title, description, scope, and constraints
- [ ] Prompt includes the **OUTPUT LOCATION** block with:
  - [ ] Generated **Run ID** (format: `RUN-XXXXXX`, where X = alphanumeric)
  - [ ] **Exact folder path**: `workspace/projects/{projectId}/runs/{runId}/`
  - [ ] `taskId` field (matches task created in Step 2)
  - [ ] `runId` field (matches generated Run ID)
  - [ ] Clear instruction: "Include 'task_id' in job_result.json"
- [ ] **Copy** button is clickable and copies full prompt to clipboard
- [ ] Compiled prompt includes agent role context (e.g., "You are implementing...")
- [ ] Changing the agent role updates token count
- [ ] Changing the task updates all prompt fields

---

## Step 4: Send to AI Coder

**Goal**: Use compiled prompt with an external AI tool to generate artifacts.

1. Copy the compiled prompt (from Step 3)
2. Paste into your AI tool of choice:
   - Google Gemini Flash
   - Claude 3.5 Sonnet (or Haiku)
   - ChatGPT 4
   - Cursor/code editor integrated AI
3. Instruct the AI to follow the OUTPUT LOCATION block exactly
4. AI should write code and produce **5 artifact files**:
   - `job_result.json`
   - `changed_files.json`
   - `review_checklist.json`
   - `job_summary.md`
   - `code_snippets.md`

**Checkpoints**:
- [ ] AI output is generated and saved locally
- [ ] Files are written to the exact path in OUTPUT LOCATION block:
  - [ ] Full path: `workspace/projects/{projectId}/runs/{runId}/`
  - [ ] Directory structure exists (create if needed)
- [ ] `job_result.json` exists and contains:
  - [ ] `tool` (e.g., "claude", "gemini", "gpt4")
  - [ ] `model` (e.g., "claude-3.5-sonnet", "gemini-2.0-flash")
  - [ ] `status` (must be: `complete`, `partial`, or `failed`)
  - [ ] `summary` (brief text description)
  - [ ] `risks` (array of identified risks)
  - [ ] `manual_validation` (boolean: true if human review needed)
  - [ ] `commit_hash` (if applicable, or empty string)
  - [ ] `created_at` (ISO 8601 timestamp)
  - [ ] **`task_id`** (must match task from Step 2)
  - [ ] **`run_id`** (must match Run ID from Step 3)
- [ ] `changed_files.json` contains array with objects:
  - [ ] `path` (file path relative to project root)
  - [ ] `change_type` (e.g., "modified", "created", "deleted")
  - [ ] `purpose` (brief description of why)
  - [ ] `risk_level` (e.g., "low", "medium", "high")
- [ ] `review_checklist.json` contains:
  - [ ] `items` array with at least one object:
    - [ ] `category` (e.g., "Logic", "Testing", "Performance")
    - [ ] `check` (e.g., "Diagonal fishing is blocked")
    - [ ] `priority` (e.g., "high", "medium", "low")
- [ ] `job_summary.md` exists and is readable
- [ ] `code_snippets.md` exists with code examples

---

## Step 5: Import the Run

**Goal**: Scan for new runs and import them into the app with auto-linking.

1. Click **Runs** tab in the sidebar
2. Click **Scan** button (app auto-detects new run folders in `workspace/projects/{projectId}/runs/`)
3. A card should appear labeled **Ready to Import** showing:
   - Run ID (format: `RUN-XXXXXX`)
   - Summary text from `job_result.json`
   - Status badge (yellow = ready)

**Checkpoints**:
- [ ] Scan button is clickable and completes without errors
- [ ] **Ready to Import** card appears with correct Run ID
- [ ] Card displays summary from `job_result.json`
- [ ] Card shows file count (number of artifact files detected)
- [ ] If `job_result.json` contains `task_id`:
  - [ ] Task is auto-linked (no dropdown required)
  - [ ] Card shows linked task name
- [ ] If `job_result.json` does NOT contain `task_id`:
  - [ ] Dropdown appears: "Select Task to Link"
  - [ ] Dropdown shows all available tasks from project
  - [ ] Manual selection works and populates link
- [ ] **Import** button is visible and clickable on the card
- [ ] Clicking Import shows loading indicator
- [ ] Green success banner appears: "Run imported. Review Now →"
- [ ] Success banner has a clickable link to jump to Review tab

---

## Step 6: Review the Run

**Goal**: Review changes, approve, request revision, or reject.

1. Click **Review Now →** in the success banner (or navigate to **Review** tab)
2. Review panel opens with two sections:

   **Left Panel**:
   - Run summary (from `job_result.json`)
   - List of changed files (from `changed_files.json`)
   - File details: path, change type, purpose, risk level

   **Right Panel**:
   - Task specification (from original task)
   - Three action buttons: **Approve** | **Request Revision** | **Reject**

**Checkpoints**:
- [ ] Review panel displays without errors
- [ ] Run summary matches `job_result.json` content
- [ ] Changed files list is populated and accurate
- [ ] Each file shows: path, change type, purpose, risk level
- [ ] Task spec is visible and accurate
- [ ] Approve button is clickable
- [ ] Reject button is clickable
- [ ] Request Revision button is clickable

### 6A: Approve Path

1. Click **Approve** button
2. A closure modal appears with:
   - AI-drafted summary (review and confirm)
   - Review checklist items (from `review_checklist.json`)
3. Click **Confirm & Proceed** in modal

**Checkpoints** (Approve):
- [ ] Closure modal appears with summary
- [ ] Summary is readable and accurate
- [ ] Checklist items are displayed
- [ ] Confirm button closes modal
- [ ] Proceed to Step 7 (Decision Anchor Gate)

### 6B: Reject Path

1. Click **Reject** button
2. Optional: confirmation dialog appears
3. Click **Confirm Rejection**

**Checkpoints** (Reject):
- [ ] Task is marked as **BLOCKED** in the backlog
- [ ] Run is marked with rejection status
- [ ] Run can be deleted or re-scanned
- [ ] No new run folder is created

### 6C: Request Revision Path

1. Click **Request Revision** button
2. A **text box** appears: "What needs to be fixed?"
3. Type specific, actionable feedback (e.g., "The isNearWater check allows diagonal fishing — fix only that function")
4. Click **Build Revision Prompt** button

**Checkpoints** (Request Revision):
- [ ] Text box is visible and editable
- [ ] Build Revision Prompt button is clickable
- [ ] Revision prompt preview appears showing:
  - [ ] What the previous run did (summary)
  - [ ] Changed files from previous run
  - [ ] Your specific feedback verbatim
  - [ ] Constraints and invariants from original task
  - [ ] **NEW run folder path**: `workspace/projects/{projectId}/runs/{runId-v2}/` (incremented)
  - [ ] **New Run ID** (format: `RUN-XXXXXX-v2`)
  - [ ] Token count recalculated
- [ ] Copy button is functional
- [ ] **Mark Active** checkbox is available
- [ ] Clicking **Copy Prompt + Mark Active**:
  - [ ] Copies prompt to clipboard
  - [ ] Task is set back to **ACTIVE** status (from REVIEW)
  - [ ] Run is marked as "Awaiting Revision"

**Next Steps**: Paste the revision prompt into AI tool and repeat from Step 4 (with new runId and runId-v2 path).

---

## Step 7: Approve and Close

**Goal**: Finalize the run with a decision anchor gate.

1. After clicking Approve in Step 6, the **Decision Anchor Gate** modal appears
2. Modal presents a **Status** dropdown with options:
   - `Solved` — Issue is fully resolved
   - `Broken` — Implementation introduced new issues
   - `Unsolved` — Issue remains despite effort
   - `BugPatch` — Quick fix for a bug (not full solution)
   - `Update` — Routine update or maintenance
   - `DifficultProblemWithSolution` — Complex issue now solved
3. Select the appropriate status
4. Click **Confirm & Close** button

**Checkpoints**:
- [ ] Decision Anchor Gate modal appears after Approve confirmation
- [ ] Status dropdown is accessible and populated
- [ ] All 6 status options are available
- [ ] Selecting a status updates the preview
- [ ] Confirm button closes modal
- [ ] Task **moves to DONE** column in the backlog
- [ ] Task shows completion badge with selected status
- [ ] Run is marked as APPROVED + status in database
- [ ] Project health badge remains green (or updates if rules were broken)
- [ ] Clicking the completed task shows all linked runs and decisions

---

## Common Failures

| **Problem** | **Cause** | **Fix** |
|-------------|----------|--------|
| **Schema validation error** | `job_result.json` missing required fields | Ensure AI includes all fields: `tool`, `model`, `status`, `summary`, `risks`, `manual_validation`, `commit_hash`, `created_at`, `task_id`, `run_id` |
| **Unknown Task in Review** | `task_id` in `job_result.json` does not match any task ID | Verify task was created before prompt generation; re-scan runs and manually select correct task in dropdown |
| **No linked runs** | Run folder exists but scan doesn't detect it | Check folder path: must be `workspace/projects/{projectId}/runs/{runId}/`; verify `job_result.json` exists in root of folder |
| **Empty compiled prompt** | Task dropdown shows no selection or is loading | Ensure task was saved in Step 2; refresh page; check browser console for API errors |
| **Revision prompt shows no summary** | Previous run summary field is null or empty | Ensure first run's `job_result.json` has a valid `summary` field (non-empty string) |
| **Token count shows 0** | Agent role not selected or prompt template is broken | Select an agent role from dropdown; clear browser cache and reload |
| **"Ready to Import" card never appears** | Scan doesn't find new run folder | Manually verify folder exists at `workspace/projects/{projectId}/runs/{runId}/`; check file permissions; restart app |
| **Task marked BLOCKED after rejection** | Expected behavior (verify this is correct) | This is correct; manually move task back to BACKLOG if re-work is needed |

---

## Flash Coding Rules

**Critical Requirements for AI Code Generation**

### job_result.json — Required Fields

```json
{
  "tool": "gemini",           // REQUIRED: "claude", "gemini", "gpt4", "gpt4o", etc.
  "model": "gemini-2.0-flash", // REQUIRED: exact model version used
  "status": "complete",        // REQUIRED: one of: "complete", "partial", "failed"
  "summary": "Fixed diagonal fishing by restricting isNearWater() to cardinal directions",
  "risks": [
    "Save file compatibility may break for old saves with invalid states",
    "Performance impact unknown without benchmarking"
  ],
  "manual_validation": false,  // REQUIRED: boolean — does code need human review?
  "commit_hash": "abc1234def",  // REQUIRED: git hash or empty string ""
  "created_at": "2026-03-17T14:32:00Z",  // REQUIRED: ISO 8601 timestamp
  "task_id": "task-fish-01",   // REQUIRED: must match task ID from app
  "run_id": "RUN-ABC123"       // REQUIRED: must match Run ID from prompt
}
```

### Status Values — Valid Inputs

- `complete` — All work finished; artifact files fully implement task scope
- `partial` — Some features completed; note limitations in summary
- `failed` — Work could not be completed; explain blocker in summary

### Result Values — For Review Checklist

When creating `review_checklist.json`, use these priority levels:

- `high` — Must be correct; blocks approval
- `medium` — Important; should be reviewed
- `low` — Nice-to-have; non-blocking

Example format:

```json
{
  "items": [
    {
      "category": "Logic",
      "check": "Diagonal fishing is blocked (cardinal directions only)",
      "priority": "high"
    },
    {
      "category": "Testing",
      "check": "Unit tests added for isNearWater()",
      "priority": "high"
    },
    {
      "category": "Performance",
      "check": "No noticeable lag in fishing interactions",
      "priority": "medium"
    }
  ]
}
```

### Artifact Files — Output Checklist

AI must generate and save all 5 files to the exact path in OUTPUT LOCATION block:

- [ ] `job_result.json` — Metadata and status
- [ ] `changed_files.json` — List of all modified/created/deleted files with details
- [ ] `review_checklist.json` — QA items for human review
- [ ] `job_summary.md` — Markdown summary of changes
- [ ] `code_snippets.md` — Key code snippets showing the fix

### Path Validation

- Run folder must be created at: `workspace/projects/{projectId}/runs/{runId}/`
- All 5 files must be in root of run folder (not in subdirectories)
- Path must be readable by app after AI writes files
- App scans this exact path when "Scan" is clicked

---

## Testing Shortcuts & Tips

1. **Skip Step 4 if testing import/review flow**: Manually create a `job_result.json` file with valid task_id and run_id; place in run folder; click Scan.

2. **Test revision loop**: After Request Revision in Step 6, use the new run folder path provided in the revision prompt. Don't forget to increment the Run ID.

3. **Reset between tests**: Delete the run folder from `workspace/projects/{projectId}/runs/{runId}/` to re-test scan and import.

4. **Verify invariants**: After closing a task, check that project health badge is still green. If it turns red, an invariant was violated.

5. **Token counter calibration**: MAX mode roles should consistently show 3000–6000 tokens for the same task. If numbers vary wildly, check the prompt template.

6. **Manual linking**: If auto-link fails (no task_id), verify the task ID from the task detail panel and select it manually from the dropdown.

---

## Endpoints & File Paths (Reference)

| Component | Path / Reference |
|-----------|------------------|
| Projects folder | `workspace/projects/` |
| Runs folder | `workspace/projects/{projectId}/runs/` |
| Run artifacts | `workspace/projects/{projectId}/runs/{runId}/` |
| Database | App-specific storage (SQLite or equivalent) |
| Environment Variable | `basePath` (defaults to `./workspace`) |
| Task ID format | User-defined (e.g., `task-fish-01`) |
| Run ID format | Generated (`RUN-XXXXXX`) |

---

**End of Test Walkthrough**

Last verified: 2026-03-17
