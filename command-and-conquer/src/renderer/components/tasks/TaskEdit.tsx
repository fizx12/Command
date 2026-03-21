import React, { useState, useEffect } from 'react';
import SizeSelector from './SizeSelector';
import { TaskSize, Task } from '../../../main/types/task.types';

interface TaskEditProps {
  task?: Task | null;
  projectId: string;
  onSave: (data: Partial<Task>) => Promise<void>;
  onCancel: () => void;
  onReturnToGenerator?: () => void;
  isSaving?: boolean;
  initialTitle?: string;
  initialDescription?: string;
}

const TaskEdit: React.FC<TaskEditProps> = ({
  task,
  projectId,
  onSave,
  onCancel,
  onReturnToGenerator,
  isSaving = false,
  initialTitle = '',
  initialDescription = ''
}) => {
  const [title, setTitle] = useState(task?.title || initialTitle);
  const [description, setDescription] = useState(task?.description || initialDescription);
  const [size, setSize] = useState<TaskSize>(task?.size as TaskSize || 'Standard');
  const [scope, setScope] = useState(task?.scope || '');
  const [outOfScope, setOutOfScope] = useState(task?.outOfScope || '');
  const [mustPreserve, setMustPreserve] = useState<string[]>(task?.mustPreserve || []);
  const [preserveInput, setPreserveInput] = useState('');
  
  const [improvingTask, setImprovingTask] = useState(false);
  const [improveError, setImproveError] = useState('');

  const handleImproveTask = async () => {
    if (!title.trim()) return;
    const settingsRes = await window.api.settings.get();
    const apiKey = settingsRes?.data?.openaiApiKey || '';
    if (!apiKey) {
      setImproveError('OpenAI API key not set — add it in Settings');
      return;
    }
    
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

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title,
      description,
      size,
      scope,
      outOfScope,
      mustPreserve,
    });
  };

  return (
    <div className="bg-surface-alt rounded-xl p-5 border border-accent/20 shadow-xl animate-in slide-in-from-top duration-200 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-text-primary text-sm">
          {task ? 'Edit Task' : 'New Task'}
        </h3>
        <div className="flex items-center gap-3">
          {onReturnToGenerator && (
            <button
              onClick={onReturnToGenerator}
              className="px-3 py-1 bg-accent/20 text-accent rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all shadow-sm border border-accent/30"
            >
              ← Back to Generator
            </button>
          )}
          <button onClick={onCancel} className="text-text-secondary hover:text-text-primary text-lg leading-none">
            ×
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-text-secondary uppercase">Title</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="flex-1 bg-surface text-text-primary p-2 rounded border border-surface outline-none focus:border-accent text-sm"
                placeholder="Task name"
                autoFocus
              />
              <button
                type="button"
                onClick={handleImproveTask}
                disabled={!title.trim() || improvingTask}
                title="AI fills in description, scope, out of scope, and invariants"
                className="px-3 py-1.5 bg-purple-600/20 border border-purple-600/30 text-purple-400 rounded text-xs font-bold hover:bg-purple-600/30 disabled:opacity-40 transition whitespace-nowrap flex items-center gap-1.5"
              >
                {improvingTask ? (
                  <span className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin block" />
                ) : (
                  '✨ AI Fill'
                )}
              </button>
            </div>
            {improveError && <p className="text-[10px] text-badge-red mt-0.5">{improveError}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-text-secondary uppercase">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="bg-surface text-text-primary p-2 rounded border border-surface outline-none focus:border-accent resize-none text-sm"
              rows={3}
              placeholder="Describe what you want — AI will refine this and fill in scope + invariants"
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
                value={scope}
                onChange={e => setScope(e.target.value)}
                className="bg-surface text-text-primary p-2 rounded border border-surface outline-none focus:border-badge-green resize-none text-[11px]"
                rows={4}
                placeholder="What to change"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-badge-red uppercase">Out of Scope</label>
              <textarea
                value={outOfScope}
                onChange={e => setOutOfScope(e.target.value)}
                className="bg-surface text-text-primary p-2 rounded border border-surface outline-none focus:border-badge-red resize-none text-[11px]"
                rows={4}
                placeholder="Don't touch"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-accent uppercase">Must Preserve</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={preserveInput}
                onChange={e => setPreserveInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && preserveInput.trim()) {
                    setMustPreserve([...mustPreserve, preserveInput.trim()]);
                    setPreserveInput('');
                  }
                }}
                className="flex-1 bg-surface text-text-primary p-1.5 rounded border border-surface outline-none focus:border-accent text-xs"
                placeholder="Invariant (Enter to add)"
              />
            </div>
            {mustPreserve.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1 max-h-20 overflow-y-auto">
                {mustPreserve.map((p, i) => (
                  <span key={i} className="bg-accent/10 text-accent px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                    {p}
                    <button
                      onClick={() => setMustPreserve(mustPreserve.filter((_, idx) => idx !== i))}
                      className="opacity-60 hover:opacity-100"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-surface">
        <button
          onClick={onReturnToGenerator || onCancel}
          className="px-4 py-1.5 text-sm text-text-secondary hover:text-accent font-bold transition-colors"
        >
          {onReturnToGenerator ? 'Discard & Return' : 'Cancel'}
        </button>
        <button
          onClick={handleSave}
          disabled={!title.trim() || isSaving}
          className="px-5 py-1.5 bg-accent text-white rounded-lg font-bold text-sm shadow-lg shadow-accent/20 disabled:opacity-50 min-w-[100px]"
        >
          {isSaving ? 'Saving...' : task ? 'Save Changes' : 'Create Task'}
        </button>
      </div>
    </div>
  );
};

export default TaskEdit;
