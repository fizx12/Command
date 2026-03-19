import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import { useRuns, useImportRun } from '../hooks/useRuns';
import { useTasks } from '../hooks/useTasks';

type PendingRun = {
  runId: string;
  folderPath: string;
  hasAllArtifacts: boolean;
  summary?: string;
  taskId?: string;
};

const RunImporter: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { runs, loading, refresh } = useRuns(projectId || '');
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const { importRun, loading: importing } = useImportRun();
  const { tasks = [] } = useTasks(projectId || '');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Record<string, string>>({});

  const [pendingRuns, setPendingRuns] = useState<PendingRun[]>([]);
  // Track runs the user has manually dismissed so re-scans don't bring them back
  const dismissedIdsRef = useRef<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ runId: string; staleDocCount: number; taskId?: string } | null>(null);
  const [importErrors, setImportErrors] = useState<Record<string, string>>({});
  const [promptTexts, setPromptTexts] = useState<Record<string, string>>({});
  const [showPromptId, setShowPromptId] = useState<string | null>(null);

  // Use projectId as the only dep — refresh is accessed via ref to avoid
  // the "new function every render" loop that caused dismiss to be immediately undone.
  const scanForPending = useCallback(async () => {
    if (!projectId) return;
    setScanning(true);
    try {
      const res = await window.api.runs.scanPending(projectId);
      if (res && !res.error && res.data) {
        const all = res.data as PendingRun[];

        // Runs with all artifacts + task_id baked in → auto-import immediately
        const autoImportable = all.filter(p => p.hasAllArtifacts && p.taskId);
        // Everything else surfaces for manual action, minus anything the user dismissed
        const needsManual = all.filter(
          p => (!p.hasAllArtifacts || !p.taskId) && !dismissedIdsRef.current.has(p.runId)
        );
        setPendingRuns(needsManual);

        for (const p of autoImportable) {
          try {
            const ir = await window.api.runs.importById(projectId, p.runId, p.taskId, p.folderPath);
            if (ir && !ir.error && ir.data) {
              const { run, staleDocIds } = ir.data;
              setImportResult({ runId: run.id, staleDocCount: staleDocIds.length, taskId: run.taskId });
            }
          } catch { /* non-fatal */ }
        }

        if (autoImportable.length > 0) refreshRef.current();
      }
    } finally {
      setScanning(false);
    }
  }, [projectId]); // ← only projectId; refresh via ref so this doesn't recreate every render

  // Auto-scan once on mount (stable dep means this fires exactly once)
  useEffect(() => {
    scanForPending();
  }, [scanForPending]);

  const handleImportById = async (runId: string, pendingTaskId?: string, folderPath?: string, force?: boolean) => {
    if (!projectId) return;
    const taskId = pendingTaskId || selectedTaskIds[runId];
    setImportingId(runId);
    setImportErrors(prev => { const e = { ...prev }; delete e[runId]; return e; });
    try {
      const res = await window.api.runs.importById(projectId, runId, taskId, folderPath, force);
      if (res && !res.error && res.data) {
        const { run, staleDocIds } = res.data;
        setImportResult({ runId: run.id, staleDocCount: staleDocIds.length, taskId: run.taskId });
        setPendingRuns(prev => prev.filter(p => p.runId !== runId));
        refreshRef.current();
      } else {
        const msg = res?.message || 'Import failed — check that all 5 artifact files are present';
        setImportErrors(prev => ({ ...prev, [runId]: msg }));
      }
    } catch (err: any) {
      setImportErrors(prev => ({ ...prev, [runId]: err?.message || 'Unexpected error' }));
    } finally {
      setImportingId(null);
    }
  };

  // Fallback: manual folder picker for runs outside workspace
  const handleManualImport = async () => {
    if (!projectId) return;
    const folderResponse = await window.api.settings.selectFolder();
    if (!folderResponse || folderResponse.error || !folderResponse.data) return;
    const folderPath = folderResponse.data;
    const importResponse = await importRun(projectId, folderPath);
    if (importResponse) {
      setImportResult({ runId: importResponse.run.id, staleDocCount: importResponse.staleDocIds.length });
      refresh();
    }
  };

  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [runs]);

  const loadPrompt = useCallback(async (run: any) => {
    if (!run.promptPath || promptTexts[run.id] !== undefined) return;
    const res = await window.api.runs.readPrompt(run.promptPath);
    if (res && !res.error && res.data) {
      setPromptTexts(prev => ({ ...prev, [run.id]: res.data }));
    } else {
      setPromptTexts(prev => ({ ...prev, [run.id]: '' }));
    }
  }, [promptTexts]);

  const taskTitleMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of tasks as any[]) map[t.id] = t.title;
    return map;
  }, [tasks]);

  return (
    <div className="flex-1 flex flex-col h-full bg-surface">
      <Header
        title="Runs"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={scanForPending}
              disabled={scanning}
              className="px-3 py-2 bg-surface-alt border border-surface-alt text-text-secondary rounded-lg text-sm font-medium hover:text-text-primary transition-colors flex items-center gap-2"
            >
              {scanning ? (
                <div className="w-4 h-4 border-2 border-text-secondary/30 border-t-text-secondary rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Scan
            </button>
            <button
              onClick={handleManualImport}
              disabled={importing}
              className="px-4 py-2 bg-accent text-white rounded-lg font-bold text-sm shadow-lg shadow-accent/20 hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Manual Import
            </button>
          </div>
        }
      />

      <main className="flex-1 p-6 overflow-auto flex flex-col gap-6">

        {/* Import success banner */}
        {importResult && (
          <div className="bg-badge-green/10 border border-badge-green/30 p-4 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-badge-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Run <span className="font-mono">{importResult.runId}</span> imported successfully
                </p>
                {importResult.staleDocCount > 0 && (
                  <p className="text-xs text-badge-yellow mt-0.5">{importResult.staleDocCount} docs flagged stale</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {importResult.taskId && importResult.taskId !== 'UNKNOWN' && (
                <button
                  onClick={() => navigate(`/projects/${projectId}/review/${importResult.taskId}`)}
                  className="text-sm font-bold text-accent hover:underline"
                >
                  Review Now →
                </button>
              )}
              <button onClick={() => setImportResult(null)} className="text-text-secondary hover:text-text-primary text-xs font-bold">DISMISS</button>
            </div>
          </div>
        )}

        {/* Runs with all 5 artifacts — ready to link + import */}
        {pendingRuns.filter(p => p.hasAllArtifacts).length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-badge-yellow animate-pulse" />
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
                Ready to Import ({pendingRuns.filter(p => p.hasAllArtifacts).length})
              </h3>
            </div>
            {pendingRuns.filter(p => p.hasAllArtifacts).map(pending => {
              const resolvedTaskId = pending.taskId || selectedTaskIds[pending.runId];
              const canImport = !!resolvedTaskId;
              const errorMsg = importErrors[pending.runId];
              return (
                <div key={pending.runId} className={`bg-surface-alt border rounded-xl p-4 flex flex-col gap-3 ${errorMsg ? 'border-badge-red/40' : 'border-badge-yellow/30'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-text-primary">{pending.runId}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-badge-green/20 text-badge-green px-2 py-0.5 rounded">All 5 artifacts</span>
                      </div>
                      {pending.summary && (
                        <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">{pending.summary}</p>
                      )}
                      {errorMsg && (
                        <p className="text-xs text-badge-red font-medium mt-0.5">⚠ {errorMsg}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleImportById(pending.runId, resolvedTaskId, pending.folderPath)}
                      disabled={!canImport || importingId === pending.runId}
                      className="flex-shrink-0 px-4 py-2 bg-accent text-white rounded-lg text-sm font-bold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-2"
                      title={!canImport ? 'Select a task to link first' : ''}
                    >
                      {importingId === pending.runId ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : errorMsg ? 'Retry' : 'Import'}
                    </button>
                  </div>
                  {!pending.taskId && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-badge-yellow whitespace-nowrap">Link to task:</label>
                      <select
                        value={selectedTaskIds[pending.runId] || ''}
                        onChange={e => setSelectedTaskIds(prev => ({ ...prev, [pending.runId]: e.target.value }))}
                        className="flex-1 bg-surface text-text-primary text-xs p-1.5 rounded border border-surface-alt outline-none focus:border-accent"
                      >
                        <option value="">— select task —</option>
                        {tasks.map((t: any) => (
                          <option key={t.id} value={t.id}>{t.title} ({t.id})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Runs still being written — incomplete artifacts */}
        {pendingRuns.filter(p => !p.hasAllArtifacts).length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-text-secondary animate-pulse" />
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
                Still Writing ({pendingRuns.filter(p => !p.hasAllArtifacts).length})
              </h3>
              <span className="text-[10px] text-text-secondary italic">— waiting for all 5 files</span>
            </div>
            {pendingRuns.filter(p => !p.hasAllArtifacts).map(pending => {
              const resolvedTaskId = pending.taskId || selectedTaskIds[pending.runId];
              const errorMsg = importErrors[pending.runId];
              return (
                <div key={pending.runId} className={`bg-surface-alt/50 border rounded-xl p-3 flex flex-col gap-2 ${errorMsg ? 'border-badge-red/40' : 'border-surface-alt'}`}>
                  <div className="flex items-center gap-3">
                    {importingId === pending.runId ? (
                      <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin flex-shrink-0" />
                    ) : (
                      <div className="w-3 h-3 border-2 border-text-secondary/30 border-t-text-secondary rounded-full animate-spin flex-shrink-0" />
                    )}
                    <span className="font-mono text-xs text-text-secondary flex-shrink-0">{pending.runId}</span>
                    {pending.summary && (
                      <span className="text-xs text-text-secondary line-clamp-1 flex-1 min-w-0 opacity-60">{pending.summary}</span>
                    )}
                    {/* Task selector for stuck runs */}
                    {!pending.taskId && (
                      <select
                        value={selectedTaskIds[pending.runId] || ''}
                        onChange={e => setSelectedTaskIds(prev => ({ ...prev, [pending.runId]: e.target.value }))}
                        className="bg-surface text-text-secondary text-[10px] p-1 rounded border border-surface-alt outline-none focus:border-accent max-w-[120px]"
                      >
                        <option value="">— task</option>
                        {tasks.map((t: any) => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                    )}
                    {/* Force import — passes force=true so missing optional files use stubs */}
                    <button
                      onClick={() => handleImportById(pending.runId, resolvedTaskId, pending.folderPath, true)}
                      disabled={!resolvedTaskId || importingId === pending.runId}
                      className="flex-shrink-0 px-2 py-1 text-[10px] font-bold rounded bg-badge-yellow/20 border border-badge-yellow/40 text-badge-yellow hover:bg-badge-yellow/30 disabled:opacity-30 transition-colors"
                      title={!resolvedTaskId ? 'Select a task first' : 'Force import with available files (stubs missing ones)'}
                    >
                      {importingId === pending.runId ? '…' : 'Force'}
                    </button>
                    {/* Dismiss stuck run — persists across re-scans via ref */}
                    <button
                      onClick={() => {
                        dismissedIdsRef.current.add(pending.runId);
                        setPendingRuns(prev => prev.filter(p => p.runId !== pending.runId));
                      }}
                      className="flex-shrink-0 text-text-secondary hover:text-badge-red transition-colors text-xs"
                      title="Dismiss from view"
                    >
                      ✕
                    </button>
                  </div>
                  {errorMsg && (
                    <p className="text-xs text-badge-red font-medium pl-6">⚠ {errorMsg}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Imported runs history — compact rows, expand on click */}
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-1">Run History</h3>
          {loading && runs.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
            </div>
          ) : sortedRuns.length > 0 ? (
            sortedRuns.map(run => {
              const isOpen = selectedRunId === run.id;
              const statusColor =
                run.status === 'approved' ? 'bg-badge-green' :
                run.status === 'rejected' ? 'bg-badge-red' :
                run.status === 'review' ? 'bg-accent' : 'bg-badge-yellow';
              return (
                <div key={run.id} className="flex flex-col rounded-lg overflow-hidden border border-transparent hover:border-surface-alt transition-colors">
                  {/* Compact row */}
                  <button
                    onClick={() => { setSelectedRunId(isOpen ? null : run.id); if (!isOpen) loadPrompt(run); }}
                    className="flex items-center gap-3 px-3 py-2 bg-surface-alt/40 hover:bg-surface-alt text-left w-full transition-colors group"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor}`} />
                    <span className="font-mono text-xs text-text-secondary group-hover:text-accent transition-colors w-20 flex-shrink-0">{run.id}</span>
                    <span className="text-xs text-text-primary flex-1 truncate min-w-0">
                      {run.taskId && taskTitleMap[run.taskId] ? (
                        <span className="text-text-secondary mr-1.5">{taskTitleMap[run.taskId]} —</span>
                      ) : null}
                      {run.summary || 'No summary'}
                    </span>
                    <span className="text-[10px] text-text-secondary flex-shrink-0 hidden sm:block">{run.changedFiles?.length || 0} files</span>
                    <svg
                      className={`w-3 h-3 text-text-secondary flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="bg-surface-alt/20 border-t border-surface-alt px-4 py-4 flex flex-col gap-4">
                      <div>
                        <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Summary</h4>
                        <p className="text-sm text-text-primary leading-relaxed bg-surface px-3 py-2 rounded border border-surface-alt">
                          {run.summary || 'No summary.'}
                        </p>
                      </div>
                      {(run.changedFiles?.length || 0) > 0 && (
                        <div>
                          <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Changed Files ({run.changedFiles.length})</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {run.changedFiles.map((file: any, idx: number) => (
                              <div key={idx} className="bg-surface px-2 py-1 rounded border border-surface-alt flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${file.changeType === 'added' ? 'bg-badge-green' : file.changeType === 'deleted' ? 'bg-badge-red' : 'bg-badge-yellow'}`} />
                                <span className="text-[11px] font-mono text-text-primary">{file.path}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {run.promptPath && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Original Prompt</h4>
                            <button
                              onClick={() => setShowPromptId(showPromptId === run.id ? null : run.id)}
                              className="text-[10px] font-bold text-accent hover:underline"
                            >
                              {showPromptId === run.id ? 'Hide ↑' : 'View ↓'}
                            </button>
                          </div>
                          {showPromptId === run.id && (
                            <div className="relative">
                              <pre className="bg-surface p-3 rounded border border-surface-alt text-[11px] font-mono text-text-primary whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                                {promptTexts[run.id] === undefined ? 'Loading…' : promptTexts[run.id] || 'Prompt file not found.'}
                              </pre>
                              {promptTexts[run.id] && (
                                <button
                                  onClick={() => navigator.clipboard.writeText(promptTexts[run.id])}
                                  className="absolute top-2 right-2 text-[10px] bg-surface-alt px-2 py-1 rounded border border-surface-alt text-text-secondary hover:text-text-primary"
                                >
                                  Copy
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        <button
                          onClick={async () => {
                            if (confirm('Are you sure you want to delete this run? This action cannot be undone.')) {
                              await window.api.runs.delete(projectId as string, run.id);
                              refresh(); // Refresh list to remove deleted run
                            }
                          }}
                          className="text-xs font-bold text-badge-red hover:underline"
                        >
                          Delete Run
                        </button>
                        <button
                          onClick={() => navigate(`/projects/${projectId}/review/${run.taskId}`)}
                          className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                        >
                          Review this Run →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 bg-surface-alt/30 rounded-xl border border-dashed border-surface-alt">
              <p className="text-text-secondary text-sm">No imported runs yet.</p>
              <p className="text-text-secondary text-xs mt-1 italic">Paste the compiled prompt into your AI tool — it will write artifacts here automatically.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default RunImporter;
