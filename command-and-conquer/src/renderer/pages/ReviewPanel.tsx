import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ConfirmButton from '../components/common/ConfirmButton';
import { useTask, useUpdateTask, useTasks, useDeleteTask } from '../hooks/useTasks';
import { useRuns } from '../hooks/useRuns';
import { TaskStatus } from '../../main/types/task.types';
import ClosureModal from '../components/modals/ClosureModal';
import DecisionAnchorGate from '../components/modals/DecisionAnchorGate';
import Header from '../components/layout/Header';
import RunTimeline from '../components/runs/RunTimeline';

interface EvalResult {
  score: number;
  pass: boolean;
  summary: string;
  issues: string[];
  revisionNote: string;
}

export default function ReviewPanel() {
  const { projectId = '', taskId = '' } = useParams();
  const navigate = useNavigate();
  const { task, loading: taskLoading, refresh: refreshTask } = useTask(projectId, taskId);
  const { tasks = [] } = useTasks(projectId);
  const { runs = [] } = useRuns(projectId);
  const { update } = useUpdateTask();
  const { remove: deleteTask } = useDeleteTask();

  const [showClosure, setShowClosure] = useState(false);
  const [showAnchorGate, setShowAnchorGate] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [revisionMode, setRevisionMode] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [revisionPrompt, setRevisionPrompt] = useState('');
  const [copied, setCopied] = useState(false);

  // Tighten state
  const [tightening, setTightening] = useState(false);
  const [tightenedPrompt, setTightenedPrompt] = useState('');
  const [tightenError, setTightenError] = useState('');
  const [tightenTab, setTightenTab] = useState<'original' | 'tightened'>('original');
  const [tightenSummary, setTightenSummary] = useState('');

  // Evaluate state
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [evalError, setEvalError] = useState('');
  const [showEvalPanel, setShowEvalPanel] = useState(false);

  // Loaded Prompt state
  const [loadedPrompt, setLoadedPrompt] = useState<string | null>(null);

  const linkedRuns = useMemo(() => {
    if (!task?.linkedRunIds?.length) return [];
    return runs.filter((run: { id: string }) => task.linkedRunIds.includes(run.id));
  }, [runs, task]);

  const latestRun = linkedRuns[0] ?? null;

  React.useEffect(() => {
    if (latestRun?.promptPath) {
      window.api.runs.readPrompt(latestRun.promptPath)
        .then((res: any) => {
          if (!res.error && res.data) setLoadedPrompt(res.data);
          else setLoadedPrompt(null);
        })
        .catch(() => setLoadedPrompt(null));
    } else {
      setLoadedPrompt(null);
    }
  }, [latestRun?.promptPath]);

  const appendTimeline = async (entry: Record<string, unknown>) => {
    if (!latestRun?.id || !projectId) return;
    try {
      await window.api.runs.appendTimeline(projectId, latestRun.id, entry);
    } catch { /* non-fatal */ }
  };

  const handleStatusChange = async (status: 'approved' | 'active' | 'blocked') => {
    if (!projectId || !taskId) return;
    const taskStatusMap: Record<string, TaskStatus> = {
      approved: TaskStatus.Approved,
      active: TaskStatus.Active,
      blocked: TaskStatus.Blocked,
    };
    await update(projectId, taskId, { status: taskStatusMap[status] });
    // Refresh the task so the UI reflects the new status immediately
    refreshTask();

    await appendTimeline({
      type: 'status_changed',
      title: `Status → ${status}`,
      metadata: { status },
    });

    if (status === 'approved') {
      setShowClosure(true);
    } else if (status === 'blocked') {
      // Navigate back to tasks with a brief delay so the user sees something happened
      setTimeout(() => navigate(`/projects/${projectId}/tasks`), 600);
    }
  };

  const buildRevisionPrompt = async () => {
    if (!task) {
      alert('Task not loaded yet - please wait or select a task');
      return;
    }
    if (!revisionFeedback.trim()) return;

    const runSummary = latestRun?.summary || '(no summary available)';
    const changedFiles = (latestRun?.changedFiles || []).map((f: { path: string; changeType?: string }) => `- ${f.path} (${f.changeType || 'modified'})`).join('\n') || '(none)';
    const taskTitle = task?.title || 'Unknown Task';
    const taskScope = task?.scope || 'Not specified';
    const mustPreserve = (task?.mustPreserve || []).map((i: string) => `- ${i}`).join('\n') || '(none)';

    // Get the absolute output path from main — must use the same .c2/runs path
    // the watcher monitors; a relative path causes the agent to write files that
    // Command never detects.
    let newRunId = 'RUN-' + String(Date.now()).slice(-6);
    let absoluteOutputPath = `workspace/projects/${projectId}/runs/${newRunId}`;
    try {
      const pathRes = await window.api.runs.newRunPath(projectId);
      if (!pathRes?.error && pathRes?.data) {
        newRunId = pathRes.data.runId;
        absoluteOutputPath = pathRes.data.absolutePath;
      }
    } catch { /* fall back to relative — still functional */ }

    const prompt = `# REVISION REQUEST — ${taskTitle}

## What the Previous Run Did
${runSummary}

## Files Changed in Previous Run
${changedFiles}

## Human Reviewer Feedback
${revisionFeedback.trim()}

---

## YOUR INSTRUCTIONS

Fix ONLY what the reviewer has called out above. Do not change anything else.

**Scope:** ${taskScope}
**Must Preserve:**
${mustPreserve}

Read the current state of every file before changing it. Do not assume the previous run's description matches the actual code — verify first.

After making your fixes:
1. Commit your changes
2. Write the 5 artifact files (job_result.json, changed_files.json, review_checklist.json, job_summary.md, code_snippets.md)
3. In job_summary.md, explicitly address each piece of reviewer feedback

---

## OUTPUT LOCATION — REQUIRED

Write ALL 5 artifact files to this EXACT absolute folder path:

\`\`\`
${absoluteOutputPath}
\`\`\`

**Run ID:** \`${newRunId}\`
**Project:** \`${projectId}\`
**Task:** \`${taskId}\`

This is an absolute path. Create the folder if needed. Do NOT use a relative path. Do NOT change the path.

IMPORTANT: job_result.json MUST include:
\`\`\`json
"task_id": "${taskId}",
"run_id": "${newRunId}"
\`\`\``;

    setRevisionPrompt(prompt);
    setTightenedPrompt('');
    setTightenTab('original');
    setTightenError('');

    appendTimeline({
      type: 'revision_started',
      title: 'Revision Prompt Built',
      content: revisionFeedback.trim(),
    });
  };

  const handleTighten = async () => {
    if (!revisionPrompt) return;
    const settingsRes = await window.api.settings.get();
    const apiKey = settingsRes?.data?.openaiApiKey;
    if (!apiKey) {
      setTightenError('OpenAI API key not set — add it in Settings first');
      return;
    }
    setTightening(true);
    setTightenError('');
    try {
      const res = await window.api.gemini.tightenPrompt(revisionPrompt, apiKey, 'revision');
      if (res?.error) {
        setTightenError(res.message || 'Tighten failed');
      } else {
        setTightenedPrompt(res.data.refined);
        setTightenSummary(res.data.changeSummary || '');
        setTightenTab('tightened');
        await appendTimeline({
          type: 'prompt_tightened',
          title: 'Revision Prompt Tightened',
          content: res.data.changeSummary || 'Prompt tightened for clarity',
        });
      }
    } finally {
      setTightening(false);
    }
  };

  const activePrompt = tightenTab === 'tightened' && tightenedPrompt ? tightenedPrompt : revisionPrompt;

  const copyRevisionPrompt = async () => {
    if (!activePrompt) return;
    await navigator.clipboard.writeText(activePrompt);
    setCopied(true);
    await handleStatusChange('active');
    setTimeout(() => {
      navigate(`/projects/${projectId}/tasks`);
    }, 1000);
  };

  const handleEvaluate = async () => {
    if (!latestRun || !task) return;
    const settingsRes = await window.api.settings.get();
    const apiKey = settingsRes?.data?.openaiApiKey;
    if (!apiKey) {
      setEvalError('OpenAI API key not set — add it in Settings first');
      setShowEvalPanel(true);
      return;
    }
    setEvaluating(true);
    setEvalError('');
    setShowEvalPanel(true);
    try {
      const taskSpec = { title: task.title || '', scope: task.scope || '' };
      const artifacts = {
        jobSummary: latestRun.summary || '',
        changedFiles: (latestRun.changedFiles || []).map((f: { path: string }) => f.path),
        risks: (latestRun.risks || []).map((r: { description: string }) => r.description),
      };
      const res = await window.api.runs.evaluate(taskSpec, artifacts as Record<string, unknown>, apiKey);
      if (res?.error) {
        setEvalError(res.message || 'Evaluation failed');
      } else {
        const result = res.data as EvalResult;
        setEvalResult(result);
        await appendTimeline({
          type: 'evaluated',
          title: `Score: ${result.score}/10 — ${result.pass ? 'PASS' : 'NEEDS WORK'}`,
          content: [result.summary, ...(result.issues || []).map((i: string) => `• ${i}`)].join('\n'),
          metadata: { score: result.score, pass: result.pass },
        });
      }
    } finally {
      setEvaluating(false);
    }
  };

  const handleTaskSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTaskId = e.target.value;
    if (newTaskId) {
      navigate(`/projects/${projectId}/review/${newTaskId}`);
    }
  };

  const handleEditTaskFields = () => {
    if (!projectId || !taskId) return;
    navigate(`/projects/${projectId}/tasks?edit=${taskId}&returnTo=review`);
  };

  const handleDeleteTask = async () => {
    if (!projectId || !taskId) return;
    const ok = await deleteTask(projectId, taskId);
    if (!ok) return;
    navigate(`/projects/${projectId}/tasks`, { replace: true });
  };

  return (
    <div className="flex h-full flex-col gap-0 bg-surface">
      <Header title={`Review: ${task?.title ?? 'Task'}`} />

      {!task && !taskLoading && (
        <div className="bg-badge-red/10 border-b border-badge-red/30 p-4 flex items-center gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-badge-red mb-2">Task Not Found</h3>
            <p className="text-xs text-text-secondary">The task ID in the URL ('{taskId}') could not be found. Please select the correct task below:</p>
          </div>
          <select
            value={taskId}
            onChange={handleTaskSelect}
            className="px-3 py-2 bg-surface text-text-primary text-sm rounded border border-badge-red/30 outline-none focus:border-badge-red"
          >
            <option value="">Select a task...</option>
            {tasks.map((t: { id: string; title: string }) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">

          {/* Left: Run artifacts + revision + timeline */}
          <div className="flex flex-col gap-6">

            {/* Latest run summary */}
            <div className="rounded-xl border border-surface-alt bg-surface-alt p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Latest Run</h2>
                {latestRun && (
                  <span className="font-mono text-xs text-text-secondary">{latestRun.id}</span>
                )}
              </div>
              {latestRun ? (
                <div className="flex flex-col gap-4">
                  
                  {/* Prompt Text View */}
                  {loadedPrompt && (
                    <div>
                      <div className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Original Prompt Used</div>
                      <div className="bg-surface rounded border border-surface-alt p-3 text-[11px] font-mono text-text-secondary whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                        {loadedPrompt}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Summary</div>
                    <p className="text-sm text-text-primary leading-relaxed bg-surface p-3 rounded border border-surface-alt">
                      {latestRun.summary || 'No summary available.'}
                    </p>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                      Changed Files ({latestRun.changedFiles?.length || 0})
                    </div>
                    <div className="flex flex-col gap-1">
                      {(latestRun.changedFiles || []).map((file: { path: string; changeType?: string }, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 bg-surface px-3 py-2 rounded border border-surface-alt/50">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            file.changeType === 'added' ? 'bg-badge-green' :
                            file.changeType === 'deleted' ? 'bg-badge-red' : 'bg-badge-yellow'
                          }`} />
                          <span className="font-mono text-[11px] text-text-primary truncate">{file.path}</span>
                          <span className={`ml-auto text-[10px] font-bold uppercase tracking-wide ${
                            file.changeType === 'added' ? 'text-badge-green' :
                            file.changeType === 'deleted' ? 'text-badge-red' : 'text-badge-yellow'
                          }`}>{file.changeType || 'modified'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    const kdu = (latestRun as { knowledgeDocsUpdated?: string[] }).knowledgeDocsUpdated;
                    if (!kdu || kdu.length === 0) return null;
                    return (
                    <div>
                      <div className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                        Knowledge Docs Updated
                      </div>
                      <div className="flex flex-col gap-1">
                        {kdu.map((doc: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 bg-surface px-3 py-2 rounded border border-accent/20">
                            <span className="text-[10px] font-bold text-accent uppercase tracking-wide">updated</span>
                            <span className="font-mono text-[11px] text-text-primary">{doc}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-text-secondary mt-1.5 italic">Automatically promoted to the knowledge base on import.</p>
                    </div>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-sm text-text-secondary italic">No linked runs. Import a run first.</p>
              )}
            </div>

            {/* Revision prompt area */}
            {revisionMode && (
              <div className="rounded-xl border border-badge-yellow/30 bg-surface-alt p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-badge-yellow" />
                  <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Revision Request</h2>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-text-secondary">
                    What needs to be fixed? (be specific — this becomes the AI's constrained instructions)
                  </label>
                  <textarea
                    value={revisionFeedback}
                    onChange={e => setRevisionFeedback(e.target.value)}
                    placeholder="e.g. The isNearWater check doesn't handle edge tiles correctly — player can fish from the corner when no water is adjacent. Fix only this function. Do not change movement logic."
                    className="w-full h-32 bg-surface text-text-primary text-sm p-3 rounded border border-surface-alt outline-none focus:border-accent resize-none leading-relaxed"
                  />
                </div>
                <div className="flex gap-2" title={!task ? 'Import and link a run first' : ''}>
                  <button
                    onClick={buildRevisionPrompt}
                    disabled={!revisionFeedback.trim() || !task}
                    className="flex-1 px-4 py-2 bg-badge-yellow text-black rounded-lg text-sm font-bold disabled:opacity-40 hover:opacity-90 transition"
                  >
                    Build Revision Prompt
                  </button>
                  {revisionPrompt && (
                    <button
                      onClick={handleTighten}
                      disabled={tightening}
                      className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {tightening ? (
                        <>
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Tightening...
                        </>
                      ) : (
                        '⚡ Tighten with GPT'
                      )}
                    </button>
                  )}
                </div>

                {tightenError && (
                  <div className="p-2 bg-badge-red/10 border border-badge-red/30 rounded text-badge-red text-xs">
                    {tightenError}
                  </div>
                )}

                {tightenSummary && (
                  <div className="text-[11px] text-purple-400 italic">
                    ⚡ {tightenSummary}
                  </div>
                )}

                {revisionPrompt && (
                  <div className="flex flex-col gap-2">
                    {/* Tab switcher */}
                    {tightenedPrompt && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => setTightenTab('original')}
                          className={`px-3 py-1 rounded text-xs font-bold transition ${
                            tightenTab === 'original'
                              ? 'bg-surface-alt text-text-primary border border-surface-alt'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          Original
                        </button>
                        <button
                          onClick={() => setTightenTab('tightened')}
                          className={`px-3 py-1 rounded text-xs font-bold transition ${
                            tightenTab === 'tightened'
                              ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          Tightened ✓
                        </button>
                      </div>
                    )}

                    <div className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                      {tightenTab === 'tightened' && tightenedPrompt ? 'Tightened Prompt' : 'Generated Prompt'} — Copy and paste to your AI tool
                    </div>
                    <div className="bg-surface rounded border border-surface-alt p-3 text-xs font-mono text-text-primary whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                      {activePrompt}
                    </div>
                    <button
                      onClick={copyRevisionPrompt}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                        copied ? 'bg-badge-green text-white' : 'bg-accent text-white hover:opacity-90'
                      }`}
                    >
                      {copied ? '✓ Copied! Task set to Active.' : 'Copy Prompt + Mark Active'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Run Timeline */}
            {latestRun && (
              <RunTimeline timeline={(latestRun as { timeline?: { id: string; timestamp: string; type: 'imported' | 'prompt_compiled' | 'prompt_tightened' | 'sent_to_agent' | 'evaluated' | 'status_changed' | 'revision_started' | 'knowledge_updated' | 'note'; title: string; content?: string; metadata?: Record<string, unknown> }[] }).timeline || []} />
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-surface-alt bg-surface-alt p-5">
              <h2 className="mb-4 text-sm font-bold text-text-secondary uppercase tracking-wider">Review Actions</h2>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => navigate(`/projects/${projectId}/prompt-generator?taskId=${taskId}`)}
                  className="rounded-lg bg-accent/15 border border-accent/20 text-accent px-4 py-3 text-sm font-bold transition hover:bg-accent/30 flex items-center justify-center gap-2 border-dashed"
                >
                  ← Back to Prompt Generator
                </button>
                <button
                  onClick={handleEditTaskFields}
                  disabled={!task}
                  className="rounded-lg bg-surface border border-surface-alt text-text-primary px-4 py-3 text-sm font-bold transition hover:bg-surface-alt disabled:opacity-40"
                >
                  Edit Task Fields
                </button>
                <button
                  onClick={() => handleStatusChange('approved')}
                  className="rounded-lg bg-badge-green text-white px-4 py-3 text-sm font-bold shadow-lg shadow-badge-green/20 transition hover:opacity-90"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => {
                    setRevisionMode(true);
                    setRevisionPrompt('');
                    setTightenedPrompt('');
                    setTightenTab('original');
                  }}
                  className="rounded-lg bg-badge-yellow text-black px-4 py-3 text-sm font-bold shadow-lg shadow-badge-yellow/20 transition hover:opacity-90"
                >
                  ↩ Request Revision
                </button>
                <button
                  onClick={async () => {
                    setRejecting(true);
                    await handleStatusChange('blocked');
                    // navigation happens inside handleStatusChange after 600ms
                  }}
                  disabled={rejecting}
                  className="rounded-lg bg-badge-red text-white px-4 py-3 text-sm font-bold shadow-lg shadow-badge-red/20 transition hover:opacity-90 disabled:opacity-70"
                >
                  {rejecting ? '✗ Rejecting...' : '✗ Reject'}
                </button>
                <button
                  onClick={handleEvaluate}
                  disabled={evaluating || !latestRun}
                  className="rounded-lg bg-surface border border-surface-alt text-text-primary px-4 py-3 text-sm font-bold transition hover:bg-surface-alt disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {evaluating ? (
                    <>
                      <span className="w-3 h-3 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin" />
                      Evaluating...
                    </>
                  ) : '⚡ Auto-Evaluate'}
                </button>
                <ConfirmButton
                  label="Delete Task"
                  confirmLabel="Delete this task?"
                  onConfirm={handleDeleteTask}
                  variant="danger"
                  disabled={!task}
                />
              </div>
              <div className="mt-4 pt-4 border-t border-surface-alt">
                <button
                  onClick={() => navigate(`/projects/${projectId}/tasks?create=1`)}
                  className="w-full rounded-lg bg-surface border border-surface-alt px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-alt hover:text-text-primary"
                >
                  + Create Follow-up Task
                </button>
              </div>
            </div>

            {/* Eval result panel */}
            {showEvalPanel && (
              <div className={`rounded-xl border p-5 flex flex-col gap-3 ${
                evalResult
                  ? evalResult.pass
                    ? 'border-badge-green/30 bg-badge-green/5'
                    : evalResult.score >= 5
                      ? 'border-badge-yellow/30 bg-badge-yellow/5'
                      : 'border-badge-red/30 bg-badge-red/5'
                  : 'border-surface-alt bg-surface-alt'
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Auto-Evaluation</h3>
                  <button onClick={() => setShowEvalPanel(false)} className="text-text-secondary hover:text-text-primary text-lg leading-none">×</button>
                </div>

                {evalError && (
                  <p className="text-xs text-badge-red">{evalError}</p>
                )}

                {evalResult && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-black ${
                        evalResult.pass ? 'text-badge-green' :
                        evalResult.score >= 5 ? 'text-badge-yellow' : 'text-badge-red'
                      }`}>
                        {evalResult.score}/10
                      </span>
                      <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${
                        evalResult.pass
                          ? 'bg-badge-green/20 text-badge-green'
                          : 'bg-badge-red/20 text-badge-red'
                      }`}>
                        {evalResult.pass ? 'PASS' : 'NEEDS WORK'}
                      </span>
                    </div>
                    <p className="text-xs text-text-primary leading-relaxed">{evalResult.summary}</p>
                    {evalResult.issues.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Issues</div>
                        <ul className="flex flex-col gap-1">
                          {evalResult.issues.map((issue, i) => (
                            <li key={i} className="text-xs text-text-secondary flex gap-1.5">
                              <span className="text-badge-yellow flex-shrink-0">•</span>
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {evalResult.revisionNote && (
                      <div className="bg-surface rounded border border-surface-alt p-2">
                        <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Suggested Fix</div>
                        <p className="text-xs text-text-primary">{evalResult.revisionNote}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Task context */}
            {task && (
              <div className="rounded-xl border border-surface-alt bg-surface-alt p-5">
                <h2 className="mb-3 text-sm font-bold text-text-secondary uppercase tracking-wider">Task Spec</h2>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex gap-2">
                    <span className="text-text-secondary min-w-16">Title</span>
                    <span className="text-text-primary font-medium">{task.title}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-text-secondary min-w-16">Size</span>
                    <span className="text-text-primary">{task.size}</span>
                  </div>
                  {task.scope && (
                    <div className="flex gap-2">
                      <span className="text-text-secondary min-w-16">Scope</span>
                      <span className="text-text-primary">{task.scope}</span>
                    </div>
                  )}
                  {task.mustPreserve?.length > 0 && (
                    <div className="flex flex-col gap-1 mt-2">
                      <span className="text-text-secondary text-xs font-bold uppercase tracking-wider">Must Preserve</span>
                      {task.mustPreserve.map((inv: string, i: number) => (
                        <div key={i} className="bg-surface px-3 py-1.5 rounded text-xs text-text-primary border border-surface-alt">{inv}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ClosureModal
        isOpen={showClosure}
        taskSize={task?.size || 'Standard'}
        aiDraftedSummary={task?.resolution || ''}
        aiDraftedGaps={[]}
        onCancel={() => setShowClosure(false)}
        onConfirm={() => { setShowClosure(false); setShowAnchorGate(true); }}
      />
      <DecisionAnchorGate
        isOpen={showAnchorGate}
        taskId={taskId}
        aiDraftedSummary={task?.resolution || ''}
        filesInPlay={latestRun?.changedFiles?.map((f: { path: string }) => f.path) || []}
        onCancel={() => setShowAnchorGate(false)}
        onConfirm={() => {
          setShowAnchorGate(false);
          navigate(`/projects/${projectId}/tasks`);
        }}
      />
    </div>
  );
}
