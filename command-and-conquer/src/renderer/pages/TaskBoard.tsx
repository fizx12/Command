import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/layout/Header';
import SearchBar from '../components/common/SearchBar';
import ConfirmButton from '../components/common/ConfirmButton';
import { useTasks, useCreateTask, useDeleteTask } from '../hooks/useTasks';
import { useProject } from '../hooks/useProjects';
import { useRuns } from '../hooks/useRuns';
import SizeSelector from '../components/tasks/SizeSelector';
import { TaskSize, Task } from '../../main/types/task.types';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string;
  cardBorder: string;
  headerBg: string;
  dot: string;
  actionLabel: string;
  actionStyle: string;
  actionRoute: 'review' | 'prompt-builder' | null;
  order: number;
}> = {
  review: {
    label: 'Needs Review',
    cardBorder: 'border-badge-yellow/50 shadow-badge-yellow/10 shadow-md',
    headerBg: 'bg-badge-yellow/15',
    dot: 'bg-badge-yellow animate-pulse',
    actionLabel: 'Review →',
    actionStyle: 'bg-badge-yellow text-black font-bold',
    actionRoute: 'review',
    order: 0,
  },
  blocked: {
    label: 'Blocked',
    cardBorder: 'border-badge-red/40',
    headerBg: 'bg-badge-red/10',
    dot: 'bg-badge-red',
    actionLabel: 'Unblock →',
    actionStyle: 'bg-badge-red/20 text-badge-red',
    actionRoute: 'prompt-builder',
    order: 1,
  },
  active: {
    label: 'In Progress',
    cardBorder: 'border-accent/40',
    headerBg: 'bg-accent/10',
    dot: 'bg-accent',
    actionLabel: 'Review Run →',
    actionStyle: 'bg-accent/20 text-accent',
    actionRoute: 'review',
    order: 2,
  },
  backlog: {
    label: 'Backlog',
    cardBorder: 'border-surface-alt',
    headerBg: 'bg-surface-alt/50',
    dot: 'bg-text-secondary/40',
    actionLabel: 'Start →',
    actionStyle: 'bg-surface text-text-secondary hover:text-text-primary border border-surface-alt',
    actionRoute: 'prompt-builder',
    order: 3,
  },
  approved: {
    label: 'Done',
    cardBorder: 'border-badge-green/30 opacity-60',
    headerBg: 'bg-badge-green/10',
    dot: 'bg-badge-green',
    actionLabel: 'View',
    actionStyle: 'bg-surface-alt text-text-secondary border border-surface-alt',
    actionRoute: 'review',
    order: 4,
  },
  done: {
    label: 'Done',
    cardBorder: 'border-badge-green/30 opacity-60',
    headerBg: 'bg-badge-green/10',
    dot: 'bg-badge-green',
    actionLabel: 'View',
    actionStyle: 'bg-surface-alt text-text-secondary border border-surface-alt',
    actionRoute: 'review',
    order: 4,
  },
  archived: {
    label: 'Archived',
    cardBorder: 'border-surface-alt opacity-40',
    headerBg: 'bg-surface-alt/30',
    dot: 'bg-text-secondary/20',
    actionLabel: 'View',
    actionStyle: 'bg-surface-alt text-text-secondary border border-surface-alt',
    actionRoute: null,
    order: 5,
  },
};

const STATUS_ORDER = ['review', 'blocked', 'active', 'backlog', 'approved', 'done', 'archived'];

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  latestRun: any | null;
  linkedRunCount: number;
  onAction: (route: 'review' | 'prompt-builder') => void;
  onEdit: () => void;
  onDelete: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, latestRun, linkedRunCount, onAction, onEdit, onDelete }) => {
  const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.backlog;

  return (
    <div className={`flex flex-col rounded-xl border bg-surface-alt overflow-hidden ${cfg.cardBorder} transition-all hover:scale-[1.01] hover:shadow-lg`}>
      {/* Color header strip */}
      <div className={`flex items-center justify-between px-3 py-2 ${cfg.headerBg}`}>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Size badge */}
          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
            task.size === 'Micro'    ? 'bg-blue-500/20 text-blue-400' :
            task.size === 'Major'   ? 'bg-badge-red/20 text-badge-red' :
                                      'bg-purple-500/20 text-purple-400'
          }`}>
            {task.size}
          </span>
          {/* Run count badge */}
          {linkedRunCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface text-text-secondary border border-surface-alt">
              {linkedRunCount} {linkedRunCount === 1 ? 'run' : 'runs'}
            </span>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-2 px-3 py-3 flex-1">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-sm font-semibold text-text-primary leading-snug line-clamp-2 flex-1">
            {task.title}
          </h3>
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-text-secondary hover:text-accent p-1" title="Edit Task">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
        </div>
        </div>

        {task.description && (
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Latest run chip */}
        {latestRun && (
          <div className="flex items-center gap-1.5 mt-auto">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              latestRun.status === 'approved' ? 'bg-badge-green' :
              latestRun.status === 'rejected' ? 'bg-badge-red' :
              latestRun.status === 'review'   ? 'bg-badge-yellow' : 'bg-text-secondary/40'
            }`} />
            <span className="text-[10px] font-mono text-text-secondary truncate">{latestRun.id}</span>
            {latestRun.summary && (
              <span className="text-[10px] text-text-secondary truncate flex-1 min-w-0 hidden sm:block">
                — {latestRun.summary}
              </span>
            )}
          </div>
        )}

        {/* Scope tags */}
        {task.mustPreserve?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {task.mustPreserve.slice(0, 3).map((p: string, i: number) => (
              <span key={i} className="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded border border-accent/20">
                {p}
              </span>
            ))}
            {task.mustPreserve.length > 3 && (
              <span className="text-[9px] text-text-secondary">+{task.mustPreserve.length - 3}</span>
            )}
          </div>
        )}
      </div>

      <div className="px-3 pb-3 flex items-center gap-2">
        {cfg.actionRoute && (
          <button
            onClick={() => onAction(cfg.actionRoute!)}
            className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${cfg.actionStyle}`}
          >
            {cfg.actionLabel}
          </button>
        )}
        <ConfirmButton
          label="Delete"
          confirmLabel="Confirm delete?"
          onConfirm={onDelete}
          variant="danger"
        />
      </div>
    </div>
  );
};

// ─── Status Column (for grid lanes) ──────────────────────────────────────────

interface StatusColumnProps {
  status: string;
  tasks: Task[];
  allRuns: any[];
  onAction: (taskId: string, route: 'review' | 'prompt-builder') => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const StatusColumn: React.FC<StatusColumnProps> = ({
  status, tasks, allRuns, onAction, onEdit, onDelete, collapsed, onToggleCollapse
}) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.backlog;
  if (tasks.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 min-w-0">
      {/* Column header */}
      <button
        onClick={onToggleCollapse}
        className="flex items-center gap-2 px-1 py-1 rounded hover:bg-surface-alt/50 transition-colors text-left group"
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
          {cfg.label}
        </span>
        <span className="text-[10px] font-mono text-text-secondary bg-surface-alt px-1.5 py-0.5 rounded">
          {tasks.length}
        </span>
        <svg
          className={`w-3 h-3 text-text-secondary ml-auto transition-transform ${collapsed ? '' : 'rotate-90'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Cards */}
      {!collapsed && tasks.map(task => {
        const linkedRuns = allRuns.filter((r: any) => task.linkedRunIds?.includes(r.id));
        const latestRun = linkedRuns[0] ?? null;
        return (
          <TaskCard
            key={task.id}
            task={task}
            latestRun={latestRun}
            linkedRunCount={linkedRuns.length}
            onAction={route => onAction(task.id, route)}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task.id)}
          />
        );
      })}
    </div>
  );
};

// ─── TaskBoard ────────────────────────────────────────────────────────────────

const TaskBoard: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { tasks, loading, refresh } = useTasks(projectId || '');
  const { project } = useProject(projectId || '');
  const { runs = [] } = useRuns(projectId || '');
  const { create } = useCreateTask();
  const { remove: deleteTask } = useDeleteTask();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [collapsedStatus, setCollapsedStatus] = useState<Record<string, boolean>>({
    approved: true, done: true, archived: true,
  });

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [size, setSize] = useState<TaskSize>('Standard');
  const [scope, setScope] = useState('');
  const [outOfScope, setOutOfScope] = useState('');
  const [mustPreserve, setMustPreserve] = useState<string[]>([]);
  const [preserveInput, setPreserveInput] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [improvingTask, setImprovingTask] = useState(false);
  const [improveError, setImproveError] = useState('');
  const returnTo = searchParams.get('returnTo');

  const resetFormState = () => {
    setShowCreateForm(false);
    setEditingTaskId(null);
    setTitle('');
    setDescription('');
    setSize('Standard');
    setScope('');
    setOutOfScope('');
    setMustPreserve([]);
    setPreserveInput('');
    setImproveError('');
    setSearchParams({});
  };

  const handleImproveTask = async () => {
    if (!title.trim()) return;
    const settingsRes = await window.api.settings.get();
    const apiKey = settingsRes?.data?.openaiApiKey || '';
    if (!apiKey) { setImproveError('OpenAI API key not set — add it in Settings'); return; }
    setImprovingTask(true);
    setImproveError('');
    try {
      const res = await window.api.gemini.improveTask(title.trim(), description.trim(), apiKey);
      if (res?.error) {
        setImproveError(res.message || 'Improve failed');
      } else {
        const d = res.data;
        if (d.description) setDescription(d.description);
        if (d.scope) setScope(d.scope);
        if (d.outOfScope) setOutOfScope(d.outOfScope);
        if (Array.isArray(d.mustPreserve) && d.mustPreserve.length) {
          setMustPreserve(d.mustPreserve);
        }
      }
    } catch {
      setImproveError('Improve failed');
    } finally {
      setImprovingTask(false);
    }
  };

  const populateFormFromTask = (task: Task) => {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description || '');
    setSize(task.size as TaskSize || 'Standard');
    setScope(task.scope || '');
    setOutOfScope(task.outOfScope || '');
    setMustPreserve(task.mustPreserve || []);
    setPreserveInput('');
    setShowCreateForm(true);
  };

  const buildReturnPath = (taskId: string) => {
    if (!projectId || !returnTo) return null;
    if (returnTo === 'prompt-builder') return `/projects/${projectId}/prompt-builder?taskId=${taskId}`;
    if (returnTo === 'review') return `/projects/${projectId}/review/${taskId}`;
    return null;
  };

  // Auto-fill from URL if provided (e.g. pushed from Day Builder)
  useEffect(() => {
    const editTaskId = searchParams.get('edit');
    if (editTaskId) {
      const task = tasks.find(t => t.id === editTaskId);
      if (task && task.id !== editingTaskId) {
        populateFormFromTask(task);
      } else {
        setShowCreateForm(true);
      }
      return;
    }

    const defaultTitle = searchParams.get('title');
    const defaultDesc = searchParams.get('desc');
    if (defaultTitle) {
      setTitle(defaultTitle);
      if (defaultDesc) setDescription(defaultDesc);
      setShowCreateForm(true);
      // Clean up URL so it doesn't trigger again on refresh
      setSearchParams({});
      return;
    }

    if (searchParams.get('create') === '1') {
      setShowCreateForm(true);
    }
  }, [searchParams, setSearchParams, tasks, editingTaskId]);

  const filteredTasks = useMemo(() =>
    tasks.filter(t => t.title.toLowerCase().includes(filterText.toLowerCase())),
    [tasks, filterText]
  );

  const tasksByStatus = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const s of STATUS_ORDER) map[s] = [];
    for (const task of filteredTasks) {
      const s = task.status as string;
      if (!map[s]) map[s] = [];
      map[s].push(task);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }
    return map;
  }, [filteredTasks]);

  const activeStatuses = STATUS_ORDER.filter(s => (tasksByStatus[s]?.length ?? 0) > 0);

  const handleEditClick = (task: Task) => {
    const params = new URLSearchParams();
    params.set('edit', task.id);
    if (returnTo) params.set('returnTo', returnTo);
    setSearchParams(params);
  };

  const handleDelete = async (taskId: string) => {
    if (!projectId) return;
    const ok = await deleteTask(projectId, taskId);
    if (ok) {
      if (editingTaskId === taskId) {
        resetFormState();
      }
      refresh();
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!title.trim() || !project) return;
    const currentTaskId = editingTaskId;
    if (editingTaskId) {
      const updateRes = await window.api.tasks.update(project.id, editingTaskId, {
        title, description, size, scope, outOfScope, mustPreserve,
      });
      if (updateRes?.error) return;
    } else {
      const created = await create(project.id, {
        projectId: project.id,
        activeRepoId: project.activeRepoId || '',
        title, description, size, priority: 50, scope, outOfScope, mustPreserve,
      });
      const createdTaskId = created?.id ?? null;
      if (!createdTaskId) return;
      const returnPath = createdTaskId ? buildReturnPath(createdTaskId) : null;
      resetFormState();
      refresh();
      if (returnPath) {
        navigate(returnPath, { replace: true });
      }
      return;
    }
    const returnPath = currentTaskId ? buildReturnPath(currentTaskId) : null;
    resetFormState();
    refresh();
    if (returnPath) {
      navigate(returnPath, { replace: true });
    }
  };

  const closeForm = () => {
    const currentTaskId = editingTaskId;
    const returnPath = currentTaskId ? buildReturnPath(currentTaskId) : null;
    resetFormState();
    if (returnPath) {
      navigate(returnPath, { replace: true });
    }
  };

  const handleAction = (taskId: string, route: 'review' | 'prompt-builder') => {
    if (route === 'review') navigate(`/projects/${projectId}/review/${taskId}`);
    else navigate(`/projects/${projectId}/prompt-builder?taskId=${taskId}`);
  };

  const toggleCollapse = (status: string) => {
    setCollapsedStatus(prev => ({ ...prev, [status]: !prev[status] }));
  };

  return (
    <div className="flex flex-col h-full bg-surface overflow-hidden">
      <Header
        title="Tasks"
        actions={
          <button
            onClick={() => setShowCreateForm(v => !v)}
            className="px-4 py-2 bg-accent text-white rounded-lg font-bold text-sm shadow-lg shadow-accent/20 hover:opacity-90"
          >
            + New Task
          </button>
        }
      />

      <main className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <SearchBar placeholder="Search tasks..." value={filterText} onChange={setFilterText} />

        {/* Create / Edit form */}
        {showCreateForm && (
          <div className="bg-surface-alt rounded-xl p-5 border border-accent/20 shadow-xl animate-in slide-in-from-top duration-200 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-text-primary text-sm">{editingTaskId ? 'Edit Task' : 'New Task'}</h3>
              <button onClick={closeForm} className="text-text-secondary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Title</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text" value={title} onChange={e => setTitle(e.target.value)}
                      className="flex-1 bg-surface text-text-primary p-2 rounded border border-surface outline-none focus:border-accent text-sm"
                      placeholder="Task name" autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleImproveTask}
                      disabled={!title.trim() || improvingTask}
                      title="AI fills in description, scope, out of scope, and invariants"
                      className="px-3 py-1.5 bg-purple-600/20 border border-purple-600/30 text-purple-400 rounded text-xs font-bold hover:bg-purple-600/30 disabled:opacity-40 transition whitespace-nowrap flex items-center gap-1.5"
                    >
                      {improvingTask
                        ? <span className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin block" />
                        : '✨ AI Fill'}
                    </button>
                  </div>
                  {improveError && <p className="text-[10px] text-badge-red mt-0.5">{improveError}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Description</label>
                  <textarea
                    value={description} onChange={e => setDescription(e.target.value)}
                    className="bg-surface text-text-primary p-2 rounded border border-surface outline-none focus:border-accent resize-none text-sm"
                    rows={2} placeholder="Describe what you want — AI will refine this and fill in scope + invariants"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Size</label>
                  <SizeSelector value={size} onChange={setSize} />
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-badge-green uppercase">In Scope</label>
                    <textarea
                      value={scope} onChange={e => setScope(e.target.value)}
                      className="bg-surface text-text-primary p-2 rounded border border-surface outline-none focus:border-badge-green resize-none text-xs"
                      rows={3} placeholder="What to change"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-badge-red uppercase">Out of Scope</label>
                    <textarea
                      value={outOfScope} onChange={e => setOutOfScope(e.target.value)}
                      className="bg-surface text-text-primary p-2 rounded border border-surface outline-none focus:border-badge-red resize-none text-xs"
                      rows={3} placeholder="Don't touch"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-accent uppercase">Must Preserve</label>
                  <div className="flex gap-2">
                    <input
                      type="text" value={preserveInput}
                      onChange={e => setPreserveInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && preserveInput.trim()) { setMustPreserve([...mustPreserve, preserveInput.trim()]); setPreserveInput(''); } }}
                      className="flex-1 bg-surface text-text-primary p-1.5 rounded border border-surface outline-none focus:border-accent text-xs"
                      placeholder="Invariant (Enter to add)"
                    />
                  </div>
                  {mustPreserve.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {mustPreserve.map((p, i) => (
                        <span key={i} className="bg-accent/10 text-accent px-2 py-0.5 rounded text-xs flex items-center gap-1">
                          {p}
                          <button onClick={() => setMustPreserve(mustPreserve.filter((_, idx) => idx !== i))} className="opacity-60 hover:opacity-100">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t border-surface">
              <button onClick={closeForm} className="px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary">Cancel</button>
              <button
                onClick={handleCreateOrUpdate} disabled={!title.trim()}
                className="px-5 py-1.5 bg-accent text-white rounded-lg font-bold text-sm shadow-lg shadow-accent/20 disabled:opacity-50"
              >
                {editingTaskId ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Task grid */}
        {loading && tasks.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-surface-alt/30 rounded-xl border border-dashed border-surface-alt">
            <p className="text-text-secondary text-sm">No tasks yet.</p>
            <button onClick={() => setShowCreateForm(true)} className="mt-3 text-accent text-xs font-bold hover:underline">
              + Create your first task
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
            {activeStatuses.map(status => (
              <StatusColumn
                key={status}
                status={status}
                tasks={tasksByStatus[status] || []}
                allRuns={runs}
                onAction={handleAction}
                onEdit={handleEditClick}
                onDelete={handleDelete}
                collapsed={!!collapsedStatus[status]}
                onToggleCollapse={() => toggleCollapse(status)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default TaskBoard;
