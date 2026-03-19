# STEP 5 — ALL COMPONENTS (Cheap Coder — all can run in parallel)

## ⚠️ For EVERY prompt below, send it as:
1. CONTEXT_BUNDLE.md
2. The type files referenced in the component's props (just the relevant ones, not all)
3. The prompt below

Components are UI-only — they don't call services or IPC directly. They receive data via props. So they need fewer context files than services.

Run AFTER Step 4 review. All 19 components are independent. Fire them all at once.
Use Gemini Flash for all unless noted.

Every component prompt starts with this header — I won't repeat it each time:

STANDARD HEADER (prepend to every prompt below):
```
You are a code writer. Follow these instructions exactly. Do not add features, do not refactor, do not suggest improvements. Write exactly what is specified.

TECH STACK: React 18, TypeScript strict, Tailwind CSS
RULES:
- Functional component with default export
- No required props without defaults
- Use Tailwind utility classes only
- No inline styles
- No external component libraries
- No localStorage or sessionStorage
```

---

## C1: `src/renderer/components/common/StatusPicker.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/common/StatusPicker.tsx

PROPS:
interface StatusPickerProps {
  options: string[];                    // list of status labels
  value: string;                        // currently selected
  onChange: (value: string) => void;
  label?: string;                       // optional label above picker
}

RENDERS:
- If label provided: a text-secondary text-sm label above the picker
- A row of pill-shaped buttons, one per option
- Selected option has bg-accent text-white
- Unselected options have bg-surface-alt text-text-secondary, hover:bg-surface
- Clicking an option calls onChange with that option's value

SIZE: compact — pills should be inline, not stacked

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## C2: `src/renderer/components/common/ConfirmButton.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/common/ConfirmButton.tsx

PROPS:
interface ConfirmButtonProps {
  label: string;                        // e.g. "Delete"
  confirmLabel?: string;                // e.g. "Are you sure?" — defaults to "Confirm?"
  onConfirm: () => void;
  variant?: 'danger' | 'primary';       // default 'primary'
  disabled?: boolean;
}

BEHAVIOR:
1. First click: button text changes to confirmLabel, background changes to badge-yellow
2. If clicked again within 3 seconds: calls onConfirm
3. If 3 seconds pass without second click: reverts to original label
4. Use useState for confirmation state, useEffect with setTimeout for auto-revert

RENDERS: A single button element with Tailwind classes.

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## C3: `src/renderer/components/common/SearchBar.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/common/SearchBar.tsx

PROPS:
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;                 // defaults to "Search..."
}

RENDERS:
- A div with bg-surface-alt rounded-lg flex items-center px-3
- A magnifying glass icon (just an SVG path inline, simple circle + line)
- An input with bg-transparent, no border, text-text-primary, placeholder text-text-secondary
- Full width

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## C4: `src/renderer/components/layout/Sidebar.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/layout/Sidebar.tsx

PROPS:
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeProjectId: string | null;
}

RENDERS:
- Fixed-width sidebar: w-64 when expanded, w-16 when collapsed
- bg-surface, border-r border-surface-alt
- Top: app name "C&C" (or full "Command & Conquer" when expanded)
- Toggle button (hamburger icon) at top right
- Nav links (using react-router-dom NavLink):
  - Dashboard (icon: grid, path: /)
  - Projects (icon: folder, path: /projects)
  - Settings (icon: gear, path: /settings)
- If activeProjectId is set, show project-specific links:
  - Tasks (path: /projects/{id}/tasks)
  - Runs (path: /projects/{id}/runs)
  - Prompt Builder (path: /projects/{id}/prompt-builder)
  - Knowledge (path: /projects/{id}/knowledge)
  - Agents (path: /projects/{id}/agents)
- Active link has bg-accent/20 text-accent
- Icons: use simple inline SVGs (just basic shapes). When collapsed, show only icons.

IMPORTS: { NavLink } from 'react-router-dom'

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## C5: `src/renderer/components/layout/Header.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/layout/Header.tsx

PROPS:
interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;            // optional buttons to render on the right
}

RENDERS:
- Horizontal bar: flex justify-between items-center py-4 px-6
- Left: title (text-xl font-semibold text-text-primary) and subtitle below if provided (text-sm text-text-secondary)
- Right: {actions} rendered as-is

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## C6: `src/renderer/components/layout/HealthBadge.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/layout/HealthBadge.tsx

PROPS:
interface HealthBadgeProps {
  status: 'green' | 'yellow' | 'red';
  size?: 'sm' | 'md';                   // default 'md'
  showLabel?: boolean;                   // default false
}

RENDERS:
- A colored circle: w-3 h-3 rounded-full for sm, w-4 h-4 for md
- bg-badge-green, bg-badge-yellow, or bg-badge-red based on status
- If showLabel: text next to circle — "Healthy" / "Warning" / "Critical"
- Inline flex with items-center gap-2

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## D1: `src/renderer/components/tasks/TaskCard.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/tasks/TaskCard.tsx

PROPS:
interface TaskCardProps {
  id: string;
  title: string;
  status: string;
  size: 'Micro' | 'Standard' | 'Major';
  priority: number;
  onClick: () => void;
}

RENDERS:
- A card: bg-surface-alt rounded-lg p-4 cursor-pointer hover:ring-1 hover:ring-accent
- Top row: size badge (small pill — Micro=blue, Standard=purple, Major=red) + priority number
- Middle: title (text-text-primary font-medium, max 2 lines, truncate)
- Bottom: status pill (text-xs, color varies: backlog=gray, active=blue, review=yellow, done=green)
- Clicking card calls onClick

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## D2: `src/renderer/components/tasks/TaskDetail.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/tasks/TaskDetail.tsx

PROPS:
interface TaskDetailProps {
  task: {
    id: string; title: string; description: string; status: string;
    size: string; priority: number; scope: string; outOfScope: string;
    mustPreserve: string[]; activePhase: string; linkedRunIds: string[];
    resolution: string;
  };
  onStatusChange: (status: string) => void;
  onClose: () => void;
}

RENDERS:
- Full-width panel bg-surface rounded-lg p-6
- Header: title (text-xl) + close button (X icon) top right
- Status row: current status pill + dropdown to change status (select element)
- Grid of detail sections (2 columns on large screens):
  - Size | Priority
  - Scope | Out of Scope
  - Must Preserve (bullet list)
  - Active Phase
  - Linked Runs (list of IDs, or "No runs yet")
  - Resolution (if status is done/archived)
- Description at bottom (full width, whitespace-pre-wrap)

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## D3: `src/renderer/components/tasks/SizeSelector.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/tasks/SizeSelector.tsx

PROPS:
interface SizeSelectorProps {
  value: 'Micro' | 'Standard' | 'Major';
  onChange: (size: 'Micro' | 'Standard' | 'Major') => void;
}

RENDERS:
- Three cards in a row (flex gap-3):
  - Micro: "Quick fix, single file, <30min" — icon: lightning bolt
  - Standard: "Multi-file, 30min-half day" — icon: wrench
  - Major: "Architecture change, >half day" — icon: building
- Selected card: ring-2 ring-accent bg-accent/10
- Unselected: bg-surface-alt hover:bg-surface
- Each card shows name (bold) and description (text-sm text-text-secondary)
- Icons: simple inline SVG shapes

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## D4: `src/renderer/components/runs/RunCard.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/runs/RunCard.tsx

PROPS:
interface RunCardProps {
  id: string;
  tool: string;
  model: string;
  status: string;
  summary: string;
  changedFileCount: number;
  createdAt: string;
  onClick: () => void;
}

RENDERS:
- Card: bg-surface-alt rounded-lg p-4 cursor-pointer hover:ring-1 hover:ring-accent
- Top: run ID (text-sm text-text-secondary) + tool/model badges (pills)
- Middle: summary (text-text-primary, max 3 lines truncated)
- Bottom: "{changedFileCount} files changed" + relative time (just show the date string, don't compute relative)
- Status indicator: colored dot left of ID

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## D5: `src/renderer/components/runs/ArtifactViewer.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/runs/ArtifactViewer.tsx

PROPS:
interface ArtifactViewerProps {
  artifacts: { name: string; content: string; type: 'json' | 'markdown' }[];
}

RENDERS:
- Tab bar at top: one tab per artifact (by name)
- Selected tab: underline accent color
- Content area below: show artifact content
  - If type is 'json': wrap in <pre> with bg-surface p-4 rounded text-sm font-mono, pretty-printed
  - If type is 'markdown': render as plain text in a div (no markdown parser — just whitespace-pre-wrap)
- Use useState for activeTab index, default 0

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## D6: `src/renderer/components/knowledge/DocCard.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/knowledge/DocCard.tsx

PROPS:
interface DocCardProps {
  id: string;
  title: string;
  category: string;
  trustLevel: string;
  staleFlag: boolean;
  conflictFlag: boolean;
  lastUpdatedAt: string;
  onClick: () => void;
}

RENDERS:
- Card: bg-surface-alt rounded-lg p-4 cursor-pointer
- Top row: title (font-medium) + stale/conflict badges if flagged
  - staleFlag=true: small yellow "STALE" badge
  - conflictFlag=true: small red "CONFLICT" badge
- Middle: category pill (text-xs) + trustLevel pill
- Bottom: "Updated: {lastUpdatedAt}"

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## D7: `src/renderer/components/knowledge/FreshnessIndicator.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/knowledge/FreshnessIndicator.tsx

PROPS:
interface FreshnessIndicatorProps {
  staleFlag: boolean;
  lastReviewedAt: string;
  watchFiles: string[];
}

RENDERS:
- If staleFlag: yellow background bar with warning icon + "This document may be stale"
- Below: "Last reviewed: {lastReviewedAt}"
- Below: "Watching: {watchFiles.length} file patterns" (expandable — click to show list)
- If not stale: green text "Up to date" with check icon

Use useState for expanded watchFiles list.

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## D8: `src/renderer/components/knowledge/ConflictPanel.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/knowledge/ConflictPanel.tsx

PROPS:
interface ConflictPanelProps {
  conflict: {
    id: string;
    docIdA: string;
    docIdB: string;
    description: string;
    recommendation: string;
    resolution: string | null;
  };
  onResolve: (resolution: 'acceptA' | 'acceptB' | 'manualMerge') => void;
}

RENDERS:
- Header: "Conflict: {conflict.id}"
- Two-column layout:
  - Left: "Document A: {docIdA}" with accent border-l-4
  - Right: "Document B: {docIdB}" with accent border-l-4
- Below: "AI Summary: {description}" in a bg-surface-alt rounded box
- Below: "Recommendation: {recommendation}" in italic
- If resolution is null: three buttons — "Accept A" | "Accept B" | "Manual Merge"
- If resolved: show "Resolved: {resolution}" badge in green

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## D9: `src/renderer/components/prompts/PromptPreview.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/prompts/PromptPreview.tsx

PROPS:
interface PromptPreviewProps {
  compiledText: string;
  tokenEstimate: number;
  onCopy: () => void;
  onExport: () => void;
}

RENDERS:
- Header bar: "Compiled Prompt" + token count badge ("{tokenEstimate} est. tokens")
- Two buttons right-aligned: "Copy to Clipboard" and "Export File"
- Content area: bg-surface rounded-lg p-4, overflow-y-auto max-h-[600px]
  - Show compiledText in whitespace-pre-wrap font-mono text-sm
- Copy button calls onCopy, Export calls onExport

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## D10: `src/renderer/components/prompts/ArtifactTailBlock.tsx`

```
{STANDARD HEADER}

FILE: src/renderer/components/prompts/ArtifactTailBlock.tsx

PROPS:
interface ArtifactTailBlockProps {
  outputPath: string;                    // e.g. "workspace/projects/proj-1/runs/"
  runId: string;
}

RENDERS:
- A highlighted box: bg-accent/10 border border-accent/30 rounded-lg p-4
- Title: "Artifact Write Instructions — Required" (font-semibold)
- Numbered list of 5 required artifacts:
  1. job_result.json
  2. job_summary.md
  3. changed_files.json
  4. review_checklist.json
  5. code_snippets.md
- Shows the output path: "Write to: {outputPath}/RUN-{runId}/"
- Warning text at bottom: "Do not skip artifacts. Small tasks produce small artifacts, not no artifacts."

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## M1: `src/renderer/components/modals/DecisionAnchorGate.tsx` → Haiku

```
{STANDARD HEADER}

FILE: src/renderer/components/modals/DecisionAnchorGate.tsx

PROPS:
interface DecisionAnchorGateProps {
  isOpen: boolean;
  taskId: string;
  aiDraftedSummary: string;            // pre-filled summary from AI
  filesInPlay: string[];               // auto-populated from run artifacts
  onConfirm: (anchor: { status: string; summary: string }) => void;
  onCancel?: () => void;               // optional — gate should generally not be dismissible
}

BEHAVIOR:
1. Modal overlay: fixed inset-0 bg-black/60 flex items-center justify-center z-50
2. Modal card: bg-surface rounded-xl p-6 w-full max-w-lg
3. Title: "Before you move on..." (text-xl)
4. Status picker using 6 pill buttons in a 2x3 grid:
   - Solved, Broken, Unsolved, Bug patch, Update, Difficult problem with solution
5. Summary field: textarea pre-filled with aiDraftedSummary, editable
6. Files in play: read-only list (text-sm text-text-secondary)
7. Confirm button: disabled until a status is selected
8. On confirm: calls onConfirm with { status, summary }
9. If onCancel provided: small "Skip" text link (but this should rarely appear)

Use useState for selectedStatus and editedSummary.

THIS IS A HARD BLOCK — the UI should feel firm, not optional.

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## M2: `src/renderer/components/modals/ClosureModal.tsx` → Haiku

```
{STANDARD HEADER}

FILE: src/renderer/components/modals/ClosureModal.tsx

PROPS:
interface ClosureModalProps {
  isOpen: boolean;
  taskSize: 'Micro' | 'Standard' | 'Major';
  aiDraftedSummary: string;
  aiDraftedGaps: string[];
  onConfirm: (closure: {
    resolution: string;
    solvedSummary: string;
    remainingGaps: string[];
    sourceDocsUpdated: boolean;
    solvedIssueCreated: boolean;
  }) => void;
  onCancel: () => void;
}

BEHAVIOR:
- Modal overlay (same as DecisionAnchorGate)
- Content varies by taskSize:

MICRO:
- Title: "Quick Close"
- Resolution: text input (one line)
- Summary: pre-filled, editable textarea (short)
- Confirm button
- No gaps, no doc check, no solved issue prompt

STANDARD:
- Title: "Close Task"
- Resolution: text input
- Summary: pre-filled, editable textarea
- Remaining gaps: editable list (show aiDraftedGaps, allow adding/removing)
- Checkbox: "Source docs updated?"
- Confirm button

MAJOR:
- Title: "Full Closure"
- Everything in Standard PLUS:
- Checkbox: "Solved issue created?"
- Warning if remainingGaps is non-empty: "You have open gaps. Create follow-up tasks?"
- Confirm button

Use useState for all editable fields. Pre-fill from props.

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## M3: `src/renderer/components/modals/ConflictResolutionModal.tsx` → Haiku

```
{STANDARD HEADER}

FILE: src/renderer/components/modals/ConflictResolutionModal.tsx

PROPS:
interface ConflictResolutionModalProps {
  isOpen: boolean;
  conflictId: string;
  docATitle: string;
  docBTitle: string;
  description: string;
  recommendation: string;
  onResolve: (resolution: 'acceptA' | 'acceptB' | 'manualMerge') => void;
  onClose: () => void;
}

RENDERS:
- Modal overlay
- Title: "Resolve Conflict"
- AI summary box: description text in bg-surface-alt
- Recommendation in italic
- Three large buttons stacked:
  - "Accept: {docATitle}" (bg-accent)
  - "Accept: {docBTitle}" (bg-accent)
  - "Manual Merge" (bg-surface-alt, outlined)
- Cancel/close button

OUTPUT FORMAT: Just the complete TypeScript file contents.
```

---

## STEP 5 REVIEW — PASTE INTO SMART AI

```
Review these 19 React component files. Check:

1. Do all components use Tailwind classes from the configured theme (badge-green, badge-yellow, badge-red, surface, surface-alt, text-primary, text-secondary, accent)?
2. Are all components self-contained (no cross-component imports)?
3. Do modals use the same overlay pattern (fixed inset-0 bg-black/60 z-50)?
4. Does DecisionAnchorGate feel like a hard block (no easy dismiss)?
5. Does ClosureModal correctly show different fields per task size?
6. Do all onClick/onChange handlers match the prop signatures?
7. Any missing useState imports?
8. Any components using localStorage? (FORBIDDEN)

Output: issues with fixes, or "COMPONENTS APPROVED."

{PASTE ALL 19 FILES HERE}
```
