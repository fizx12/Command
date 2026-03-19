import React from 'react';

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

const TaskDetail: React.FC<TaskDetailProps> = ({ task, onStatusChange, onClose }) => {
  const Section = ({ title, children, fullWidth = false }: { title: string; children: React.ReactNode; fullWidth?: boolean }) => (
    <div className={`flex flex-col gap-1 ${fullWidth ? 'col-span-full' : ''}`}>
      <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">{title}</span>
      <div className="text-text-primary text-sm bg-surface-alt/50 p-3 rounded border border-surface-alt">
        {children}
      </div>
    </div>
  );

  const getStatusBadgeClass = () => {
    const s = task.status.toLowerCase();
    if (s === 'backlog') return 'bg-gray-500/20 text-gray-400';
    if (s === 'active' || s === 'in_progress') return 'bg-blue-500/20 text-blue-400';
    if (s === 'review') return 'bg-yellow-500/20 text-yellow-400';
    if (s === 'done' || s === 'completed') return 'bg-badge-green/20 text-badge-green';
    return 'bg-surface-alt text-text-secondary';
  };

  return (
    <div className="w-full bg-surface rounded-lg p-6 flex flex-col gap-6 shadow-xl border border-surface-alt">
      <div className="flex justify-between items-start">
        <h2 className="text-xl font-bold text-text-primary leading-tight">
          {task.title}
          <div className="text-xs font-mono text-text-secondary mt-1">{task.id}</div>
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-surface-alt text-text-secondary transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-4 py-2 border-y border-surface-alt/50">
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusBadgeClass()}`}>
          {task.status.replace(/_/g, ' ')}
        </span>
        <select
          value={task.status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="bg-surface-alt text-text-primary text-xs rounded border border-surface-alt px-2 py-1 outline-none focus:border-accent"
        >
          <option value="backlog">Backlog</option>
          <option value="active">Active</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Size">{task.size}</Section>
        <Section title="Priority">P{task.priority}</Section>
        <Section title="Scope">{task.scope || 'N/A'}</Section>
        <Section title="Out of Scope">{task.outOfScope || 'N/A'}</Section>
        
        <Section title="Must Preserve" fullWidth>
          {task.mustPreserve && task.mustPreserve.length > 0 ? (
            <ul className="list-disc list-inside flex flex-col gap-1">
              {task.mustPreserve.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <span className="italic text-text-secondary">None specified</span>
          )}
        </Section>

        <Section title="Active Phase">{task.activePhase || 'N/A'}</Section>
        
        <Section title="Linked Runs">
          {task.linkedRunIds && task.linkedRunIds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {task.linkedRunIds.map(id => (
                <span key={id} className="text-[10px] font-mono bg-accent/10 px-1.5 py-0.5 rounded text-accent">
                  {id}
                </span>
              ))}
            </div>
          ) : (
            <span className="italic text-text-secondary">No runs yet</span>
          )}
        </Section>

        {(task.status.toLowerCase() === 'done' || task.status.toLowerCase() === 'archived') && (
          <Section title="Resolution" fullWidth>
            {task.resolution || 'No resolution recorded'}
          </Section>
        )}

        <Section title="Description" fullWidth>
          <div className="whitespace-pre-wrap leading-relaxed">
            {task.description}
          </div>
        </Section>
      </div>
    </div>
  );
};

export default TaskDetail;
