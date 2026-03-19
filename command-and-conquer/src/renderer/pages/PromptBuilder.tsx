import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import ConfirmButton from '../components/common/ConfirmButton';
import { useTasks, useDeleteTask } from '../hooks/useTasks';
import PromptPreview from '../components/prompts/PromptPreview';
import ArtifactTailBlock from '../components/prompts/ArtifactTailBlock';
import Header from '../components/layout/Header';
import StatusPicker from '../components/common/StatusPicker';

type PromptMode = 'MAX' | 'WeakSAUCE';
type TaskSize = 'Micro' | 'Standard' | 'Major';

type CompiledPromptResult = {
  compiledText: string;
  tokenEstimate?: number;
  pendingRunId?: string;
  promptPath?: string;
};

export default function PromptBuilder() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tasks = [], refresh: refreshTasks } = useTasks(projectId) as { tasks: { id: string; title: string; status?: string }[]; refresh?: () => void };
  const { remove: deleteTask } = useDeleteTask();

  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedMode, setSelectedMode] = useState<PromptMode>('MAX');
  const [compiledPrompt, setCompiledPrompt] = useState<string>('');
  const [tokenEstimate, setTokenEstimate] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [copiedTighten, setCopiedTighten] = useState(false);
  const [copiedArchitect, setCopiedArchitect] = useState(false);
  const [dispatched, setDispatched] = useState(false);

  // Manual tighten paste-back state
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteMode, setPasteMode] = useState<'tighten' | 'architect' | null>(null);
  const [pasteInput, setPasteInput] = useState('');
  const [applyingResult, setApplyingResult] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [appliedLevel, setAppliedLevel] = useState('');
  const [applyReason, setApplyReason] = useState('');
  const [applyEnhancements, setApplyEnhancements] = useState('');
  const [finalPassResult, setFinalPassResult] = useState('');
  const [architectPasteInput, setArchitectPasteInput] = useState('');
  const [applyingArchitect, setApplyingArchitect] = useState(false);
  const [architectError, setArchitectError] = useState('');
  const [architectStatus, setArchitectStatus] = useState('');

  // Tighten state
  const [tightening, setTightening] = useState(false);
  const [tightenedPrompt, setTightenedPrompt] = useState<string>('');
  const [tightenError, setTightenError] = useState('');
  const [promptView, setPromptView] = useState<'compiled' | 'tightened'>('compiled');
  
  // Track the run ID assigned when compiled
  const [activeRunId, setActiveRunId] = useState<string>('NEW');

  // New task inline state
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskScope, setNewTaskScope] = useState('');
  const [newTaskOutOfScope, setNewTaskOutOfScope] = useState('');
  const [newTaskMustPreserve, setNewTaskMustPreserve] = useState('');
  const [newTaskSize, setNewTaskSize] = useState<TaskSize>('Standard');
  const [creatingTask, setCreatingTask] = useState(false);
  const [createTaskError, setCreateTaskError] = useState('');
  const [improvingTask, setImprovingTask] = useState(false);
  const [improveError, setImproveError] = useState('');
  const [localTasks, setLocalTasks] = useState<{ id: string; title: string; status?: string }[] | null>(null);

  const displayTasks = localTasks ?? tasks;

  const selectedTask = useMemo(
    () => displayTasks.find((task) => task.id === selectedTaskId) ?? null,
    [displayTasks, selectedTaskId]
  );

  React.useEffect(() => {
    const taskIdFromUrl = searchParams.get('taskId');
    if (taskIdFromUrl && taskIdFromUrl !== selectedTaskId) {
      setSelectedTaskId(taskIdFromUrl);
    }
  }, [searchParams, selectedTaskId]);

  /** Pick a recommended coder model based on mode + step + task size. */
  const recommendedModel = useMemo(() => {
    const size = (selectedTask as any)?.size ?? 'Standard';
    const isComplex = selectedMode === 'MAX' || size === 'Major';
    if (isComplex) return { label: 'claude-opus-4 / gpt-5.4', color: 'text-accent', hint: 'Full context — complex task' };
    return { label: 'claude-sonnet / gpt-4o', color: 'text-badge-green', hint: 'Lightweight — isolated change' };
  }, [selectedMode, selectedTask]);

  // The active prompt to use for copy / send
  const activePrompt = promptView === 'tightened' && tightenedPrompt ? tightenedPrompt : compiledPrompt;
  const previewStateLabel = appliedLevel
    ? (appliedLevel === 'ARCHITECT' ? '🏗️ ARCHITECT' : `Applied ${appliedLevel}`)
    : tightenedPrompt
      ? 'Tightened'
      : 'Original';
  const previewStateTone: 'default' | 'tightened' | 'applied' = appliedLevel
    ? 'applied'
    : tightenedPrompt
      ? 'tightened'
      : 'default';
  const previewStateBanner = appliedLevel
    ? (appliedLevel === 'ARCHITECT'
      ? `Architect result active. ${applyReason || 'The architect plan has been fused into the executor prompt.'}`
      : `Applied result active. ${applyReason || 'The tightened prompt is now loaded in the preview.'}${finalPassResult && finalPassResult !== 'OK' ? ` Final pass: ${finalPassResult}` : ''}`)
    : tightenedPrompt
      ? 'Tightened prompt is active in the preview.'
      : 'Original compiled prompt.';

  const syncSelectedTaskToUrl = (taskId: string) => {
    const params = new URLSearchParams(searchParams);
    if (taskId) {
      params.set('taskId', taskId);
    } else {
      params.delete('taskId');
    }
    setSearchParams(params);
  };

  const handleEditSelectedTask = () => {
    if (!projectId || !selectedTaskId) return;
    navigate(`/projects/${projectId}/tasks?edit=${selectedTaskId}&returnTo=prompt-builder`);
  };

  const handleDeleteSelectedTask = async () => {
    if (!projectId || !selectedTaskId) return;
    const ok = await deleteTask(projectId, selectedTaskId);
    if (!ok) return;

    if (selectedTaskId === searchParams.get('taskId')) {
      syncSelectedTaskToUrl('');
    }
    setSelectedTaskId('');
    setCompiledPrompt('');
    setTokenEstimate(0);
    setTightenedPrompt('');
    setPromptView('compiled');
    setActiveRunId('NEW');
    setDispatched(false);
    setShowPasteArea(false);
    setPasteMode(null);
    setPasteInput('');
    setArchitectPasteInput('');
    setApplyError('');
    setArchitectError('');
    setArchitectStatus('');
    setLocalTasks(prev => prev ? prev.filter(task => task.id !== selectedTaskId) : prev);
    if (refreshTasks) refreshTasks();
  };

  const handlePreview = async () => {
    if (!projectId || !selectedTaskId) return;
    const response = await window.api.prompts.preview(projectId, selectedTaskId, 'implement');
    if (response && !response.error && response.data) {
      const result = response.data as CompiledPromptResult;
      setCompiledPrompt(result?.compiledText ?? '');
      setTokenEstimate(result?.tokenEstimate ?? 0);
      setTightenedPrompt('');
      setPromptView('compiled');
    }
  };

  const handleCompileAndCopy = async () => {
    if (!projectId || !selectedTaskId) return;
    const response = await window.api.prompts.compile(projectId, selectedTaskId, 'implement');
    if (response && !response.error && response.data) {
      const result = response.data as CompiledPromptResult;
      const text = result?.compiledText ?? '';
      const estimate = result?.tokenEstimate ?? 0;
      const runId = result?.pendingRunId ?? 'NEW';

      setCompiledPrompt(text);
      setTokenEstimate(estimate);
      setActiveRunId(runId);
      setTightenedPrompt('');
      setPromptView('compiled');
      if (text) {
        await navigator.clipboard.writeText(text);
        // Mark the task as active — the prompt has been dispatched to the AI.
        // This moves the task from Backlog → Active on the TaskBoard immediately.
        try {
          await window.api.tasks.update(projectId, selectedTaskId, { status: 'active' } as any);
          if (refreshTasks) refreshTasks();
          setDispatched(true);
          setTimeout(() => setDispatched(false), 4000);
        } catch { /* non-fatal */ }
      }
    }
  };

  // Boilerplate section headers — the optimizer never needs these.
  // Task-specific sections (TASK SPECIFICATION, planner output, carry forward) always
  // appear FIRST in the compiled prompt, so we stop collecting when we hit the first static header.
  const STATIC_HEADERS_LIST = [
    'GLOBAL RULES', 'MASTER PROMPT', 'COMMAND & CONQUER',
    'APP PRIMER', 'PROJECT PRIMER', 'SOURCE OF TRUTH',
    'REPO CONTEXT', 'OUTPUT FORMAT', 'OUTPUT LOCATION',
    'AGENT ROLE', 'AGENT DEFINITION', 'STEP:',
  ];

  /**
   * Returns ONLY the task-specific sections from the compiled prompt.
   * Task spec, planner output, and carry forward are always first in the compiled
   * output — we stop collecting as soon as the first static/boilerplate header appears.
   * This means the optimizer only sees the "what", not the full app context.
   */
  const extractTaskSections = (prompt: string): string => {
    const parts = prompt.split(/\n\n---\n\n/);
    const taskParts: string[] = [];
    for (const part of parts) {
      const headerMatch = part.match(/^#+ (.+)/m);
      const header = headerMatch ? headerMatch[1].trim().toUpperCase() : '';
      // Stop at the first static section — task sections always precede boilerplate
      if (STATIC_HEADERS_LIST.some(s => header.includes(s))) break;
      taskParts.push(part);
    }
    // Fallback: if break-on-static captured nothing (e.g. non-standard headers),
    // fall back to the old denylist filter so we always return something useful.
    if (taskParts.length === 0) {
      return parts.filter(part => {
        const headerMatch = part.match(/^#+ (.+)/m);
        const header = headerMatch ? headerMatch[1].trim().toUpperCase() : '';
        return !STATIC_HEADERS_LIST.some(s => header.includes(s));
      }).join('\n\n---\n\n');
    }
    return taskParts.join('\n\n---\n\n');
  };

  /**
   * Strips static boilerplate, prepends level-picking instructions, and copies
   * to clipboard. Paste into GPT-5.4 / Claude in chat — they have more tokens.
   * The LLM picks ONE level and outputs ONLY that version.
   */
  const handleCopyToTighten = async () => {
    if (!compiledPrompt) return;
    const taskText = extractTaskSections(compiledPrompt);

    const payload = `You are a prompt engineering expert preparing a task for an AI coding agent.

Analyze the TASK SPECIFICATION below. Your job:
1. Improve the clarity and completeness of the task spec
2. Choose the minimum context level the coder needs to succeed
3. Output the improved spec — nothing else

CONTEXT LEVELS:
FULL — multi-file changes, side effects across modules, unfamiliar codebase area, or complex logic
LIGHTWEIGHT — isolated change in known area, single file/component, clear requirements
SKELETON — trivial change, rename, single-line fix, or config-only edit

RULES:
- Enhance & Clarify: Rewrite the task spec (Objective, Scope, Out of Scope, Must Preserve) to be professional, unambiguous, and highly actionable. Infer and add missing best practices (error handling, edge cases, strict typing) only if logically required but absent.
- Pick the level that gives the coder JUST ENOUGH context — no more, no less.
- Keep ALL: explicit file paths and Must Preserve constraints.
- Remove: vague language, emotional venting, repeated explanations, generic tutorials.

OUTPUT FORMAT — output in this EXACT order, no preamble, no other text:

Enhancements: <one sentence summarizing what you added or clarified vs the raw spec>
Reason: <evaluate the scope and codebase impact in one sentence>
===LEVEL: [FULL|LIGHTWEIGHT|SKELETON]===

[improved and tightened task specification here — same section headers]

---TASK SPECIFICATION---
${taskText}`;

    await navigator.clipboard.writeText(payload);
    setCopiedTighten(true);
    setPasteMode('tighten');
    setShowPasteArea(true);
    setApplyError('');
    setArchitectError('');
    setAppliedLevel('');
    setApplyReason('');
    setApplyEnhancements('');
    setFinalPassResult('');
    setArchitectStatus('🏗️ Architect payload ready — stripped to task spec + knowledge context. Paste into GPT-5.4 and return the plan.');
    setTimeout(() => setCopiedTighten(false), 2500);
  };

  /**
   * Builds the Chief Architect payload and copies it to clipboard.
   * Paste the payload into GPT-5.4 to generate a phased implementation plan.
   */
  const handleCopyAsArchitect = async () => {
    if (!projectId || !selectedTaskId) return;
    try {
      const res = await window.api.prompts.buildArchitect(projectId, selectedTaskId);
      const payload = res?.error ? '' : String(res.data?.payload || '');
      const finalPayload = payload || await buildArchitectPayloadFallback();
      if (!finalPayload) {
        setArchitectError(res?.message || 'Failed to build architect payload');
        return;
      }
      await navigator.clipboard.writeText(finalPayload);
      setCopiedArchitect(true);
      setPasteMode('architect');
      setShowPasteArea(true);
      setApplyError('');
      setArchitectError('');
      setArchitectStatus('Architect payload ready - stripped to task spec + knowledge context (MAX / WeakSAUCE). Paste into GPT-5.4 and return the plan.');
      setPasteInput('');
      setArchitectPasteInput('');
      setTimeout(() => setCopiedArchitect(false), 2500);
    } catch {
      const finalPayload = await buildArchitectPayloadFallback();
      if (!finalPayload) {
        setArchitectError('Failed to build architect payload');
        return;
      }
      await navigator.clipboard.writeText(finalPayload);
      setCopiedArchitect(true);
      setPasteMode('architect');
      setShowPasteArea(true);
      setApplyError('');
      setArchitectError('');
      setArchitectStatus('Architect payload ready - stripped to task spec + knowledge context (MAX / WeakSAUCE). Paste into GPT-5.4 and return the plan.');
      setPasteInput('');
      setArchitectPasteInput('');
      setTimeout(() => setCopiedArchitect(false), 2500);
    }
  };

  const buildArchitectPayloadFallback = async (): Promise<string> => {
    if (!projectId || !selectedTaskId) return '';

    const taskRes = await window.api.tasks.get(projectId, selectedTaskId);
    const task = taskRes?.error ? null : taskRes?.data;
    if (!task) return '';

    const docsRes = await window.api.knowledge.listDocs(projectId);
    const docs = Array.isArray(docsRes?.data) ? docsRes.data : [];
    const primerDoc = docs.find((doc: { id?: string; title?: string; name?: string }) =>
      String(doc.id || doc.title || doc.name || '').toUpperCase().includes('APP_PRIMER')
    );
    const sourceDoc = docs.find((doc: { id?: string; title?: string; name?: string }) =>
      String(doc.id || doc.title || doc.name || '').toUpperCase().includes('SOURCE_OF_TRUTH_INDEX')
    );

    // Build task spec as a single block — NOT split by --- separators
    const taskSpecLines: string[] = ['# TASK SPECIFICATION'];
    if (task.title)       taskSpecLines.push(`**Title:** ${task.title}`);
    if (task.size)        taskSpecLines.push(`**Size:** ${task.size}`);
    if (task.description) taskSpecLines.push(`\n## Objective\n${task.description}`);
    if (task.scope)       taskSpecLines.push(`\n## Scope\n${task.scope}`);
    if (task.outOfScope)  taskSpecLines.push(`\n## Out of Scope\n${task.outOfScope}`);
    if (Array.isArray(task.mustPreserve) && task.mustPreserve.length)
      taskSpecLines.push(`\n## Must Preserve\n${task.mustPreserve.map((item: string) => `- ${item}`).join('\n')}`);
    const taskSpecBlock = taskSpecLines.join('\n');

    const architectPersona = `# SYSTEM DIRECTIVE: CHIEF ARCHITECT
You are the Chief Software Architect. Your job is to take this task spec and produce a phased, literal implementation plan for a junior coding agent.

### THE RULES OF ARCHITECTURE:
1. **Zero Ambiguity:** Say exactly which component, handler, or file changes. Never say "update the UI."
2. **State the Obvious:** Explicitly list imports, interface updates, and IPC channel names when relevant.
3. **Strict Guardrails:** Define exactly what the agent must NOT touch to prevent collateral damage.
4. **Chronological Phasing:** Types/state → services/IPC → UI.

### OUTPUT FORMAT
Output ONLY the following two sections in order. No preamble, no commentary.

1. Reproduce the # TASK SPECIFICATION section from above — verbatim, unchanged.

2. Then output:

# PLANNER OUTPUT

**Phase 1: Types & State (The Foundation)**
* [ ] ...
**Phase 2: Backend & Services (The Logic)**
* [ ] ...
**Phase 3: Frontend & UI (The Presentation)**
* [ ] ...
**Phase 4: Final Verification**
* [ ] ...`;

    const sections: string[] = [architectPersona, taskSpecBlock];
    if (primerDoc?.content) sections.push(primerDoc.content);
    if (sourceDoc?.content) sections.push(sourceDoc.content);

    return sections.join('\n\n---\n\n');
  };

  /** Parse the pasted LLM result, fuse with statics, run gpt-4o-mini final pass. */
  const handleApplyResult = async () => {
    if (!pasteInput.trim() || !compiledPrompt) return;
    const settingsRes = await window.api.settings.get();
    const apiKey = settingsRes?.data?.openaiApiKey || '';
    setApplyingResult(true);
    setApplyError('');
    try {
      const res = await window.api.prompts.fuseAnalysis(compiledPrompt, pasteInput, apiKey);
      if (res?.error) {
        setApplyError(res.message || 'Apply failed');
      } else {
        const { fused, level, reason, enhancements, finalPassResult: fp } = res.data;
        setTightenedPrompt(fused);
        setPromptView('tightened');
        setAppliedLevel(level);
        setApplyReason(reason);
        setApplyEnhancements(enhancements || '');
        setFinalPassResult(fp);
        setShowPasteArea(false);
        setPasteInput('');
        if (projectId && selectedTaskId && activeRunId !== 'NEW') {
          await window.api.prompts.save(projectId, selectedTaskId, activeRunId, fused).catch(() => {});
        }
      }
    } finally {
      setApplyingResult(false);
    }
  };

  /** Takes the pasted architect plan and fuses it with execution boilerplate. */
  const handleApplyArchitectResult = async () => {
    if (!architectPasteInput.trim() || !projectId || !selectedTaskId) return;
    setApplyingArchitect(true);
    setArchitectError('');
    try {
      const res = await window.api.prompts.compileArchitect(projectId, selectedTaskId, architectPasteInput.trim());
      if (res?.error) {
        setArchitectError(res.message || 'Architect compile failed');
      } else {
        const result = res.data as CompiledPromptResult;
        setCompiledPrompt(result?.compiledText ?? '');
        setTokenEstimate(result?.tokenEstimate ?? 0);
        setActiveRunId(result?.pendingRunId ?? 'NEW');
        setTightenedPrompt(result?.compiledText ?? '');
        setPromptView('tightened');
        setAppliedLevel('ARCHITECT');
        setApplyReason('Fused architect plan with execution boilerplate');
        setApplyEnhancements('');
        setFinalPassResult('');
        setShowPasteArea(false);
        setPasteMode(null);
        setArchitectPasteInput('');
        setArchitectStatus('🏗️ ARCHITECT plan applied — task spec replaced and executor boilerplate fused.');
      }
    } finally {
      setApplyingArchitect(false);
    }
  };

  const handleTighten = async () => {
    if (!compiledPrompt) return;
    const settingsRes = await window.api.settings.get();
    const apiKey = settingsRes?.data?.openaiApiKey;
    if (!apiKey) {
      setTightenError('OpenAI API key not set — add it in Settings first');
      return;
    }
    setTightening(true);
    setTightenError('');
    try {
      const res = await window.api.gemini.tightenPrompt(compiledPrompt, apiKey);
      if (res?.error) {
        setTightenError(res.message || 'Tighten failed');
      } else {
        const tightText = res.data.refined;
        setTightenedPrompt(tightText);
        setPromptView('tightened');
        // Save tightened prompt to overwrite the backend's compiled run prompt
        if (projectId && selectedTaskId && activeRunId !== 'NEW') {
          await window.api.prompts.save(projectId, selectedTaskId, activeRunId, tightText).catch(() => {});
        }
      }
    } finally {
      setTightening(false);
    }
  };

  const handleCopyActive = async () => {
    if (!activePrompt) return;
    await navigator.clipboard.writeText(activePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Mark task active — prompt is being sent to the AI
    if (projectId && selectedTaskId) {
      try {
        await window.api.tasks.update(projectId, selectedTaskId, { status: 'active' } as any);
        if (refreshTasks) refreshTasks();
        setDispatched(true);
        setTimeout(() => setDispatched(false), 4000);
      } catch { /* non-fatal */ }
    }
  };

  /** Call gpt-4o-mini to improve the task description and fill in missing fields. */
  const handleImproveTask = async () => {
    if (!newTaskTitle.trim()) return;
    const settingsRes = await window.api.settings.get();
    const apiKey = settingsRes?.data?.openaiApiKey || '';
    if (!apiKey) { setImproveError('OpenAI API key not set — add it in Settings'); return; }
    setImprovingTask(true);
    setImproveError('');
    try {
      const res = await window.api.gemini.improveTask(newTaskTitle.trim(), newTaskDescription.trim(), apiKey);
      if (res?.error) {
        setImproveError(res.message || 'Improve failed');
      } else {
        const d = res.data;
        if (d.description) setNewTaskDescription(d.description);
        if (d.scope) setNewTaskScope(d.scope);
        if (d.outOfScope) setNewTaskOutOfScope(d.outOfScope);
        if (Array.isArray(d.mustPreserve) && d.mustPreserve.length) {
          setNewTaskMustPreserve(d.mustPreserve.join('\n'));
        }
      }
    } catch (e) {
      setImproveError('Improve failed');
    } finally {
      setImprovingTask(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !projectId) return;
    setCreatingTask(true);
    setCreateTaskError('');
    try {
      const mustPreserveList = newTaskMustPreserve
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
      const res = await window.api.tasks.create(projectId, {
        projectId,
        activeRepoId: '',
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim(),
        size: newTaskSize,
        priority: 50,
        scope: newTaskScope.trim(),
        outOfScope: newTaskOutOfScope.trim(),
        mustPreserve: mustPreserveList,
      });
      if (res?.error) {
        setCreateTaskError(res.message || 'Failed to create task');
      } else {
        const listRes = await window.api.tasks.list(projectId);
        if (listRes?.data) {
          setLocalTasks(listRes.data as { id: string; title: string; status?: string }[]);
        }
        if (refreshTasks) refreshTasks();
        if (res.data?.id) {
          setSelectedTaskId(res.data.id);
          syncSelectedTaskToUrl(res.data.id);
        }
        // Reset form
        setNewTaskTitle('');
        setNewTaskDescription('');
        setNewTaskScope('');
        setNewTaskOutOfScope('');
        setNewTaskMustPreserve('');
        setNewTaskSize('Standard');
        setImproveError('');
        setShowNewTask(false);
      }
    } finally {
      setCreatingTask(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-6">
      <Header title="Prompt Builder" />

      <div className="grid flex-1 min-h-0 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="rounded-lg border border-surface-alt bg-surface-alt p-5 flex min-h-0 flex-col overflow-hidden">
          <div className="space-y-5 flex-1 min-h-0 overflow-y-auto pr-1">

            {/* Task selector with inline new task */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-text-primary">Task</label>
                <button
                  onClick={() => { setShowNewTask(s => !s); setCreateTaskError(''); }}
                  className={`text-xs font-bold px-2 py-0.5 rounded transition ${
                    showNewTask
                      ? 'bg-accent/20 text-accent'
                      : 'text-text-secondary hover:text-accent'
                  }`}
                >
                  {showNewTask ? '✕ cancel' : '+ New'}
                </button>
              </div>
              <select
                className="w-full rounded-md border border-surface-alt bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                value={selectedTaskId}
                onChange={(e) => {
                  const taskId = e.target.value;
                  setSelectedTaskId(taskId);
                  syncSelectedTaskToUrl(taskId);
                }}
              >
                <option value="">Select a task</option>
                {displayTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>

              {/* Inline new task form */}
              {showNewTask && (
                <div className="mt-3 p-3 bg-surface border border-accent/20 rounded-lg flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-accent uppercase tracking-widest">New Task</div>
                  </div>

                  {/* Title row with ✨ Improve button */}
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      placeholder="Task title (required)"
                      className="flex-1 bg-surface-alt text-text-primary text-sm p-2 rounded border border-surface-alt outline-none focus:border-accent"
                    />
                    <button
                      onClick={handleImproveTask}
                      disabled={!newTaskTitle.trim() || improvingTask}
                      title="AI fills in description, scope, and invariants using gpt-4o-mini"
                      className="px-2.5 py-1.5 bg-purple-600/20 border border-purple-600/30 text-purple-400 rounded text-xs font-bold hover:bg-purple-600/30 disabled:opacity-40 transition whitespace-nowrap flex items-center gap-1"
                    >
                      {improvingTask
                        ? <><span className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /></>
                        : '✨ AI'}
                    </button>
                  </div>

                  {/* Description */}
                  <textarea
                    value={newTaskDescription}
                    onChange={e => setNewTaskDescription(e.target.value)}
                    placeholder="Describe what you want — AI will refine this and fill in scope + invariants"
                    rows={3}
                    className="w-full bg-surface-alt text-text-primary text-xs p-2 rounded border border-surface-alt outline-none focus:border-accent resize-none"
                  />

                  {/* Scope */}
                  <input
                    type="text"
                    value={newTaskScope}
                    onChange={e => setNewTaskScope(e.target.value)}
                    placeholder="Scope — files/components that will change"
                    className="w-full bg-surface-alt text-text-primary text-xs p-2 rounded border border-surface-alt outline-none focus:border-accent"
                  />

                  {/* Out of scope */}
                  <input
                    type="text"
                    value={newTaskOutOfScope}
                    onChange={e => setNewTaskOutOfScope(e.target.value)}
                    placeholder="Out of scope — what must NOT be touched"
                    className="w-full bg-surface-alt text-text-primary text-xs p-2 rounded border border-surface-alt outline-none focus:border-accent"
                  />

                  {/* Must preserve */}
                  <textarea
                    value={newTaskMustPreserve}
                    onChange={e => setNewTaskMustPreserve(e.target.value)}
                    placeholder={"Must preserve (one per line):\nexisting auth flow\nIPC pattern for tasks"}
                    rows={2}
                    className="w-full bg-surface-alt text-text-primary text-xs p-2 rounded border border-surface-alt outline-none focus:border-accent font-mono resize-none"
                  />

                  {/* Size picker */}
                  <div className="flex gap-1">
                    {(['Micro', 'Standard', 'Major'] as TaskSize[]).map(s => (
                      <button
                        key={s}
                        onClick={() => setNewTaskSize(s)}
                        className={`flex-1 py-1 rounded text-xs font-bold transition ${
                          newTaskSize === s
                            ? 'bg-accent text-white'
                            : 'bg-surface-alt text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {(createTaskError || improveError) && (
                    <p className="text-[10px] text-badge-red">{createTaskError || improveError}</p>
                  )}
                  <button
                    onClick={handleCreateTask}
                    disabled={!newTaskTitle.trim() || creatingTask}
                    className="w-full py-1.5 bg-accent text-white rounded text-xs font-bold disabled:opacity-50 hover:opacity-90 transition"
                  >
                    {creatingTask ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              )}

              {selectedTaskId && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleEditSelectedTask}
                    className="flex-1 rounded-lg border border-surface-alt bg-surface px-3 py-2 text-xs font-bold text-text-primary transition hover:border-accent/40 hover:text-accent"
                  >
                    Edit Fields
                  </button>
                  <button
                    onClick={() => navigate(`/projects/${projectId}/tasks`)}
                    className="flex-1 rounded-lg border border-surface-alt bg-surface px-3 py-2 text-xs font-bold text-text-secondary transition hover:border-accent/40 hover:text-text-primary"
                  >
                    Done
                  </button>
                  <ConfirmButton
                    label="Delete"
                    confirmLabel="Delete task?"
                    onConfirm={handleDeleteSelectedTask}
                    variant="danger"
                  />
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 block text-sm font-medium text-text-primary">Mode</div>
              <div className="flex gap-2">
                {(['MAX', 'WeakSAUCE'] as PromptMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSelectedMode(mode)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      selectedMode === mode
                        ? 'bg-accent text-white'
                        : 'bg-surface text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Model recommendation */}
            <div className="flex items-center justify-between bg-surface border border-surface-alt rounded-lg px-3 py-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Recommended Coder Model</span>
                <span className={`text-sm font-mono font-bold ${recommendedModel.color}`}>{recommendedModel.label}</span>
              </div>
              <span className="text-[10px] text-text-secondary italic text-right max-w-[100px] leading-tight">{recommendedModel.hint}</span>
            </div>

            <div>
              <div className="mb-2 block text-sm font-medium text-text-primary">Task Status</div>
              <StatusPicker
                value={String((selectedTask as { status?: string } | null)?.status ?? 'backlog')}
                onChange={() => {}}
                options={['backlog', 'active', 'review', 'approved', 'done', 'blocked', 'archived']}
              />
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={handlePreview}
                className="w-full py-2 bg-surface text-text-primary rounded-lg font-bold text-sm border border-surface-alt hover:bg-surface-alt transition-colors"
              >
                Preview
              </button>

              {/* Compile & Tighten row */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCompileAndCopy}
                  className="flex-1 py-2 bg-accent text-white rounded-lg font-bold text-sm shadow-lg shadow-accent/20 hover:opacity-90 transition-all"
                >
                  Compile &amp; Copy
                </button>
                <button
                  type="button"
                  onClick={handleTighten}
                  disabled={tightening || !compiledPrompt}
                  title={!compiledPrompt ? 'Compile a prompt first' : 'Delta tighten with GPT-5.4 (task sections only)'}
                  className="flex-1 py-2 bg-purple-600 text-white rounded-lg font-bold text-sm hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {tightening ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Tightening...
                    </>
                  ) : '⚡ Tighten'}
                </button>
              </div>

              {/* Manual tighten — copy stripped prompt for chat LLM paste */}
              {compiledPrompt && (
                <button
                  type="button"
                  onClick={handleCopyToTighten}
                  title="Strips boilerplate, adds level-picking instructions — paste into GPT-5.4 or Claude chat"
                  className={`w-full py-2 rounded-lg font-bold text-sm transition-all border ${
                    copiedTighten
                      ? 'bg-badge-green/20 border-badge-green/40 text-badge-green'
                      : 'bg-surface border-surface-alt text-text-secondary hover:text-text-primary hover:border-accent/40'
                  }`}
                >
                  {copiedTighten ? '✔ Copied — paste into chat LLM' : '📋 Copy to Tighten (manual)'}
                </button>
              )}

              {selectedTaskId && (
                <button
                  type="button"
                  onClick={handleCopyAsArchitect}
                  title="Builds a Chief Architect payload with task + knowledge context — paste into GPT-5.4 to get a phased implementation plan"
                  className={`w-full py-2 rounded-lg font-bold text-sm transition-all border ${
                    copiedArchitect
                      ? 'bg-badge-green/20 border-badge-green/40 text-badge-green'
                      : 'bg-surface border-purple-600/30 text-purple-400 hover:text-purple-300 hover:border-purple-600/50'
                  }`}
                >
                  {copiedArchitect ? '✔ Copied — paste into GPT-5.4' : '🏗️ Copy as Architect'}
                </button>
              )}
              {architectStatus && (
                <div className="rounded-lg border border-purple-600/30 bg-purple-600/10 px-3 py-2 text-[11px] font-medium text-purple-300">
                  {architectStatus}
                </div>
              )}

              {/* Paste-back area — appears after Copy to Tighten is clicked */}
              {showPasteArea && (
                <div className="flex flex-col gap-2 p-3 bg-surface border border-accent/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-accent uppercase tracking-widest">
                      {pasteMode === 'architect' ? 'Paste Architect Plan' : 'Paste LLM Result'}
                    </span>
                    <button
                      onClick={() => {
                        setShowPasteArea(false);
                        setPasteMode(null);
                      }}
                      className="text-text-secondary hover:text-text-primary text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  {pasteMode === 'architect' ? (
                    <textarea
                      value={architectPasteInput}
                      onChange={e => setArchitectPasteInput(e.target.value)}
                      placeholder={'# TASK SPECIFICATION\n\n## Objective\n...\n\n## Scope\n...\n\n---\n\n# PLANNER OUTPUT\n**Phase 1: ...'}
                      rows={6}
                      className="w-full bg-surface-alt text-text-primary text-xs p-2 rounded border border-surface-alt outline-none focus:border-accent font-mono resize-none"
                    />
                  ) : (
                    <textarea
                      value={pasteInput}
                      onChange={e => setPasteInput(e.target.value)}
                      placeholder={'Enhancements: Added error handling and edge cases\nReason: Isolated single-component change with clear requirements\n===LEVEL: LIGHTWEIGHT===\n\n[tightened content]'}
                      rows={6}
                      className="w-full bg-surface-alt text-text-primary text-xs p-2 rounded border border-surface-alt outline-none focus:border-accent font-mono resize-none"
                    />
                  )}
                  {pasteMode === 'architect'
                    ? architectError && <p className="text-[10px] text-badge-red">{architectError}</p>
                    : applyError && <p className="text-[10px] text-badge-red">{applyError}</p>}
                  <button
                    onClick={pasteMode === 'architect' ? handleApplyArchitectResult : handleApplyResult}
                    disabled={
                      pasteMode === 'architect'
                        ? !architectPasteInput.trim() || applyingArchitect
                        : !pasteInput.trim() || applyingResult
                    }
                    className="w-full py-1.5 bg-accent text-white rounded text-xs font-bold disabled:opacity-50 hover:opacity-90 transition flex items-center justify-center gap-1.5"
                  >
                    {pasteMode === 'architect'
                      ? (applyingArchitect
                        ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Applying...</>
                        : 'Apply Architect Plan')
                      : (applyingResult
                        ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Applying...</>
                        : 'Apply Result')}
                  </button>
                </div>
              )}

              {/* Level badge + final pass result after apply */}
              {appliedLevel && (
                <div className="flex flex-col gap-1.5 p-2.5 bg-surface border border-surface-alt rounded-lg">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${
                      appliedLevel === 'FULL' ? 'bg-badge-red/20 text-badge-red' :
                      appliedLevel === 'LIGHTWEIGHT' ? 'bg-accent/20 text-accent' :
                      'bg-badge-green/20 text-badge-green'
                    }`}>{appliedLevel}</span>
                    {applyReason && <span className="text-[10px] text-text-secondary italic">{applyReason}</span>}
                  </div>
                  {applyEnhancements && (
                    <div className="flex items-start gap-1.5 mt-0.5">
                      <span className="text-[10px] font-bold text-purple-400 flex-shrink-0">✨</span>
                      <p className="text-[10px] text-purple-300 italic">{applyEnhancements}</p>
                    </div>
                  )}
                  {finalPassResult && finalPassResult !== 'OK' && (
                    <div className="mt-1">
                      <p className="text-[10px] font-bold text-badge-yellow mb-1">Final pass notes:</p>
                      <p className="text-[10px] text-text-secondary whitespace-pre-wrap">{finalPassResult}</p>
                    </div>
                  )}
                  {finalPassResult === 'OK' && (
                    <p className="text-[10px] text-badge-green font-bold">✔ Final pass: OK</p>
                  )}
                </div>
              )}

              {/* View toggle + copy when tightened prompt exists */}
              {tightenedPrompt && (
                <>
                  <div className="flex gap-1 bg-surface rounded-lg p-1 border border-surface-alt">
                    <button
                      onClick={() => setPromptView('compiled')}
                      className={`flex-1 py-1 rounded text-xs font-bold transition ${
                        promptView === 'compiled'
                          ? 'bg-surface-alt text-text-primary'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Original
                    </button>
                    <button
                      onClick={() => setPromptView('tightened')}
                      className={`flex-1 py-1 rounded text-xs font-bold transition ${
                        promptView === 'tightened'
                          ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Tightened ✔
                    </button>
                  </div>
                  {/* Copy whichever version is active */}
                  <button
                    type="button"
                    onClick={handleCopyActive}
                    className={`w-full py-2 rounded-lg font-bold text-sm transition-all ${
                      copied
                        ? 'bg-badge-green text-white'
                        : promptView === 'tightened'
                          ? 'bg-purple-600 text-white hover:opacity-90'
                          : 'bg-accent text-white hover:opacity-90'
                    }`}
                  >
                    {copied
                      ? '✔ Copied!'
                      : promptView === 'tightened'
                        ? 'Copy Tightened → Antigravity'
                        : 'Copy Original → Antigravity'}
                  </button>
                </>
              )}

              {dispatched && (
                <div className="flex flex-col gap-2">
                  <div className="p-2 bg-accent/10 border border-accent/30 rounded text-accent text-xs font-medium flex items-center gap-1.5">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Prompt copied — task marked Active
                  </div>
                  <button
                    onClick={() => navigate(`/projects/${projectId}/tasks`)}
                    className="w-full py-2 bg-accent text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Done — Back to Tasks
                  </button>
                </div>
              )}

              {tightenError && (
                <div className="p-2 bg-badge-red/10 border border-badge-red/30 rounded text-badge-red text-xs">
                  {tightenError}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <div className="rounded-lg border border-surface-alt bg-surface-alt p-5 flex-1 flex flex-col min-h-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Preview
                  {tightenedPrompt && (
                    <span className={`ml-2 text-xs font-bold ${promptView === 'tightened' ? 'text-purple-400' : 'text-text-secondary'}`}>
                      {promptView === 'tightened' ? '⚡ Tightened' : 'Original'}
                    </span>
                  )}
                </h2>
                <p className="text-sm text-text-secondary">
                  {selectedTask ? selectedTask.title : 'Select a task to preview a prompt'}
                </p>
              </div>
              <div className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
                {tokenEstimate} tokens
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <PromptPreview
                compiledText={activePrompt}
                tokenEstimate={tokenEstimate}
                onCopy={handleCopyActive}
                onExport={() => {}}
                badgeLabel={previewStateLabel}
                badgeTone={previewStateTone}
                banner={previewStateBanner}
              />
            </div>
          </div>

          <div className="rounded-lg border border-surface-alt bg-surface-alt p-5 self-start w-full">
            <ArtifactTailBlock
              outputPath={`workspace/projects/${projectId}/runs`}
              runId={activeRunId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

