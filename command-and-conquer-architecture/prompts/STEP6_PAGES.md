# STEP 6 — PAGES (Cheap Coder — all 10 can run in parallel)

## ⚠️ For EVERY prompt below, send it as:
1. CONTEXT_BUNDLE.md
2. The hook files from Step 4 output (so the page knows what data hooks return)
3. The component files this page imports from Step 5 output (so it knows the prop interfaces)
4. `src/renderer/App.tsx` from Step 1A (so it knows the route paths)
5. The prompt below

Pages are the heaviest prompts — they compose hooks and components. The coder needs to see the interfaces of everything it imports.

Run AFTER Step 5 review. All pages are independent. Use Gemini Flash unless noted.

Every page prompt starts with:

STANDARD HEADER:
```
You are a code writer. Follow these instructions exactly. Do not add features.

TECH STACK: React 18, TypeScript strict, Tailwind CSS, React Router v6
RULES:
- Functional component with default export
- Import hooks from '../hooks/' for data
- Import components from '../components/' for UI
- Import useAppStore from '../stores/app.store' for navigation state
- Import { useParams, useNavigate } from 'react-router-dom' for routing
- Use Tailwind utility classes only
- No localStorage, no fetch, no direct window.api calls (hooks handle that)
```

---

## P1: `src/renderer/pages/Dashboard.tsx` → Flash

```
{STANDARD HEADER}

FILE: src/renderer/pages/Dashboard.tsx

DATA: useProjects() for project list

RENDERS:
- Header component: title="Dashboard"
- Grid of project cards (3 columns on large screens, 1 on small):
  - Each card: bg-surface-alt rounded-lg p-6
  - Project name (font-semibold text-lg)
  - HealthBadge component (pass project.healthBadge)
  - Preferred tool badge
  - "X tasks active" count (just show repoLinks.length + " repos" for now)
  - Click navigates to /projects/{id}
- If no projects: empty state — "No projects yet. Create one to get started." with a button linking to /projects

IMPORTS:
- Header from '../components/layout/Header'
- HealthBadge from '../components/layout/HealthBadge'
- { useProjects } from '../hooks/useProjects'
- { useNavigate } from 'react-router-dom'

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## P2: `src/renderer/pages/Projects.tsx` → Flash

```
{STANDARD HEADER}

FILE: src/renderer/pages/Projects.tsx

DATA: useProjects() + useCreateProject()

RENDERS:
- Header: title="Projects", actions={create button}
- SearchBar component for filtering project list
- Project list: same cards as Dashboard but in a single-column list layout
- Create button opens an inline form (not a modal) at the top of the list:
  - Fields: name (text), description (textarea), preferredTool (text), obsidianVaultPath (text + folder picker button), operationalPath (text + folder picker button)
  - Save / Cancel buttons
  - On save: call create() then refresh list
- Folder picker buttons call window.api.settings.selectFolder()

Use useState for: showCreateForm, filterText, and form field values.

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## P3: `src/renderer/pages/ProjectDetail.tsx` → Flash

```
{STANDARD HEADER}

FILE: src/renderer/pages/ProjectDetail.tsx

DATA:
- useProject(projectId) from URL params
- useAppStore to set activeProjectId on mount

RENDERS:
- Header: title={project.name}, subtitle={project.description}, actions={HealthBadge + settings icon}
- Tab bar with 5 tabs: Overview, Tasks, Runs, Knowledge, Agents
- Use useState for activeTab, default 'overview'
- Each tab renders a placeholder div with the tab name for now
  (Pages like TaskBoard, KnowledgeCenter are separate routes — these tabs just link to them)
- Overview tab shows:
  - Active repo selector (dropdown of project.repoLinks)
  - Invariants list
  - Recent activity (placeholder "Coming soon")

IMPORTS:
- { useParams, Link } from 'react-router-dom'
- { useProject } from '../hooks/useProjects'
- { useAppStore } from '../stores/app.store'
- Header, HealthBadge

Use useEffect to call setActiveProject(projectId) on mount and setActiveProject(null) on unmount.

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## P4: `src/renderer/pages/TaskBoard.tsx` → Flash

```
{STANDARD HEADER}

FILE: src/renderer/pages/TaskBoard.tsx

DATA: useTasks(projectId), useCreateTask()

RENDERS:
- Header: title="Tasks", actions={create task button + view toggle}
- View toggle: "Board" | "List" (useState)
- Board view: 4 columns — Backlog, Active, Review, Done
  - Each column: vertical stack of TaskCard components
  - Column header shows count
- List view: vertical list of TaskCard components, sorted by priority
- Create task button opens inline form:
  - Fields: title, description, SizeSelector component, priority (number), scope (textarea), outOfScope (textarea)
  - Must preserve: text input that adds to array on Enter
  - Save / Cancel
- Clicking a TaskCard opens TaskDetail as a slide-over panel from the right

Use useState for: view mode, showCreateForm, selectedTaskId, form values.
Filter tasks into columns by status for board view.

IMPORTS:
- { useParams } from 'react-router-dom'
- { useTasks, useCreateTask, useUpdateTask } from '../hooks/useTasks'
- TaskCard, TaskDetail, SizeSelector from '../components/tasks/'
- Header, SearchBar

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## P5: `src/renderer/pages/PromptBuilder.tsx` → Haiku

```
{STANDARD HEADER}

FILE: src/renderer/pages/PromptBuilder.tsx

DATA: useTasks(projectId) for task list, window.api.prompts for compile/preview

RENDERS:
- Header: title="Prompt Builder"
- Left column (config):
  - Task selector: dropdown of tasks
  - Agent selector: dropdown (hardcoded list for now: "planner_max", "implementer_max", "reviewer_max", "implementer_weaksauce")
  - Mode selector: "MAX" | "WeakSAUCE" pills
  - "Preview" button → calls window.api.prompts.preview, shows result in right column
  - "Compile & Copy" button → calls window.api.prompts.compile, copies compiledText to clipboard
- Right column (preview):
  - PromptPreview component showing compiled text
  - ArtifactTailBlock component at bottom (always visible as reminder)
- "Copy to Clipboard" calls navigator.clipboard.writeText()

Use useState for: selectedTaskId, selectedAgentId, selectedMode, compiledPrompt, tokenEstimate.

IMPORTS:
- { useParams } from 'react-router-dom'
- { useTasks } from '../hooks/useTasks'
- PromptPreview, ArtifactTailBlock from '../components/prompts/'
- Header, StatusPicker

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## P6: `src/renderer/pages/RunImporter.tsx` → Flash

```
{STANDARD HEADER}

FILE: src/renderer/pages/RunImporter.tsx

DATA: useRuns(projectId), useImportRun()

RENDERS:
- Header: title="Runs", actions={import button}
- Import button: opens folder dialog (window.api.settings.selectFolder), then calls importRun with selected path
- Import result: if staleDocIds returned, show yellow alert "X documents flagged stale"
- Run list: vertical stack of RunCard components, sorted by date
- Clicking a RunCard expands it to show ArtifactViewer with the run's artifacts
  (For now, just show the summary and changedFiles list — full artifact viewing is Phase 2)

Use useState for: selectedRunId, importResult, importing flag.

IMPORTS:
- { useParams } from 'react-router-dom'
- { useRuns, useImportRun } from '../hooks/useRuns'
- RunCard from '../components/runs/'
- Header

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## P7: `src/renderer/pages/ReviewPanel.tsx` → Haiku

```
{STANDARD HEADER}

FILE: src/renderer/pages/ReviewPanel.tsx

DATA: useTask, useRuns for linked runs

RENDERS:
- Header: title="Review: {task.title}"
- Two-column layout:
  - Left: Task spec display (scope, mustPreserve, outOfScope)
  - Right: Latest run summary + changed files list
- Below: review action buttons
  - "Approve" (green) → updates task status to 'approved'
  - "Revise" (yellow) → updates task status to 'active' (sends back for re-work)
  - "Reject" (red) → updates task status to 'blocked'
- Below actions: "Create Follow-up Task" button (navigates to TaskBoard with create form open)
- ClosureModal: opens after Approve is clicked
- DecisionAnchorGate: opens after closure is confirmed

Use useState for: showClosure, showAnchorGate.
Use useUpdateTask to change status.

IMPORTS:
- { useParams, useNavigate } from 'react-router-dom'
- { useTask, useUpdateTask } from '../hooks/useTasks'
- { useRuns } from '../hooks/useRuns'
- TaskDetail from '../components/tasks/'
- ClosureModal, DecisionAnchorGate from '../components/modals/'
- Header

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## P8: `src/renderer/pages/KnowledgeCenter.tsx` → Flash

```
{STANDARD HEADER}

FILE: src/renderer/pages/KnowledgeCenter.tsx

DATA: useDocs, useSolvedIssues, useAnchors

RENDERS:
- Header: title="Knowledge"
- Tab bar: "Documents" | "Solved Issues" | "Decisions"
- Documents tab:
  - Grid of DocCard components
  - Filter bar: "All" | "Stale" | "Conflicting" pills
  - Stale count badge if any docs are stale
- Solved Issues tab:
  - List of solved issues: title, symptom preview, tags as pills
  - SearchBar for filtering by title/symptom/tag
- Decisions tab:
  - List of decision anchors: status pill + summary + date
  - Most recent first

Use useState for: activeTab, filter, searchText.

IMPORTS:
- { useParams } from 'react-router-dom'
- { useDocs, useSolvedIssues, useAnchors } from '../hooks/useKnowledge'
- DocCard, FreshnessIndicator from '../components/knowledge/'
- Header, SearchBar, StatusPicker

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## P9: `src/renderer/pages/AgentLibrary.tsx` → Flash

```
{STANDARD HEADER}

FILE: src/renderer/pages/AgentLibrary.tsx

NOTE: For Phase 1, this page shows hardcoded agent definitions. No CRUD yet.

RENDERS:
- Header: title="Agents"
- Two sections: "MAX Agents" and "WeakSAUCE Agents"
- Each agent shown as a card:
  - Name (bold), Role, Mode badge (purple for MAX, gray for WeakSAUCE)
  - Purpose (text-sm text-text-secondary)
  - Preferred model
- MAX agents (hardcode these):
  - Auditor MAX, Planner MAX, Implementer MAX, Reviewer MAX, Compressor MAX, Truth Maintainer MAX, UX Critic MAX, Task Closer MAX
- WeakSAUCE agents:
  - Planner WeakSAUCE, Implementer WeakSAUCE, Reviewer WeakSAUCE

Create a const array of agent objects at the top of the file. Each has: name, role, mode, purpose, preferredModel.

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## P10: `src/renderer/pages/Settings.tsx` → Flash

```
{STANDARD HEADER}

FILE: src/renderer/pages/Settings.tsx

DATA: window.api.settings.get() and window.api.settings.update()

RENDERS:
- Header: title="Settings"
- Form sections:
  - Storage Paths:
    - Obsidian Vault Path: text input + "Browse" button (calls window.api.settings.selectFolder)
    - Operational Folder Path: text input + "Browse"
  - Watch Folders:
    - List of folder paths for auto-import
    - Add/remove buttons
  - Defaults:
    - Default Model: text input
    - Theme: "Dark" (only option for now, disabled)
- Save button at bottom

Use useState for all form values. Load on mount via useEffect calling settings.get(). Save calls settings.update().

IMPORTS:
- Header

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## STEP 6 REVIEW — PASTE INTO SMART AI

```
Review these 10 page files. Check:

1. Do all pages import hooks correctly (useProjects from '../hooks/useProjects', etc.)?
2. Do all pages use useParams() for projectId where needed?
3. Do route paths match what's defined in App.tsx router?
4. Does ReviewPanel correctly chain: Approve → ClosureModal → DecisionAnchorGate?
5. Does TaskBoard correctly filter tasks into kanban columns by status?
6. Does PromptBuilder copy to clipboard correctly?
7. Do all pages handle loading/error states from hooks (show loading spinner or error message)?
8. Any page making direct window.api calls instead of using hooks? (Only allowed for prompts and settings where dedicated hooks don't exist)

Output: issues with fixes, or "PAGES APPROVED."

{PASTE ALL 10 FILES HERE}
```
