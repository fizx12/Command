import React, { useState } from 'react';

type RunTimelineEventType =
  | 'imported'
  | 'prompt_compiled'
  | 'prompt_tightened'
  | 'sent_to_agent'
  | 'evaluated'
  | 'status_changed'
  | 'revision_started'
  | 'knowledge_updated'
  | 'note';

interface RunTimelineEntry {
  id: string;
  timestamp: string;
  type: RunTimelineEventType;
  title: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

interface RunTimelineProps {
  timeline: RunTimelineEntry[];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getEventColor(type: RunTimelineEventType, metadata?: Record<string, unknown>): string {
  switch (type) {
    case 'imported': return 'bg-badge-green';
    case 'prompt_compiled': return 'bg-blue-500';
    case 'prompt_tightened': return 'bg-purple-500';
    case 'sent_to_agent': return 'bg-blue-400';
    case 'evaluated': return 'bg-badge-yellow';
    case 'status_changed': {
      const status = metadata?.status as string | undefined;
      if (status === 'approved') return 'bg-badge-green';
      if (status === 'rejected' || status === 'blocked') return 'bg-badge-red';
      return 'bg-badge-yellow';
    }
    case 'revision_started': return 'bg-badge-yellow';
    case 'knowledge_updated': return 'bg-accent';
    case 'note': return 'bg-surface-alt';
    default: return 'bg-text-secondary';
  }
}

function getEventLabel(type: RunTimelineEventType): string {
  switch (type) {
    case 'imported': return 'imported';
    case 'prompt_compiled': return 'compiled';
    case 'prompt_tightened': return 'tightened';
    case 'sent_to_agent': return 'sent';
    case 'evaluated': return 'evaluated';
    case 'status_changed': return 'status';
    case 'revision_started': return 'revision';
    case 'knowledge_updated': return 'knowledge';
    case 'note': return 'note';
    default: return type;
  }
}

function getEventTextColor(type: RunTimelineEventType, metadata?: Record<string, unknown>): string {
  switch (type) {
    case 'imported': return 'text-badge-green';
    case 'prompt_compiled': return 'text-blue-400';
    case 'prompt_tightened': return 'text-purple-400';
    case 'sent_to_agent': return 'text-blue-300';
    case 'evaluated': return 'text-badge-yellow';
    case 'status_changed': {
      const status = metadata?.status as string | undefined;
      if (status === 'approved') return 'text-badge-green';
      if (status === 'rejected' || status === 'blocked') return 'text-badge-red';
      return 'text-badge-yellow';
    }
    case 'revision_started': return 'text-badge-yellow';
    case 'knowledge_updated': return 'text-accent';
    default: return 'text-text-secondary';
  }
}

function TimelineEntry({ entry, isLast }: { entry: RunTimelineEntry; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const dotColor = getEventColor(entry.type, entry.metadata);
  const textColor = getEventTextColor(entry.type, entry.metadata);
  const label = getEventLabel(entry.type);

  return (
    <div className="flex gap-3">
      {/* Left: dot + line */}
      <div className="flex flex-col items-center">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${dotColor}`} />
        {!isLast && <div className="w-px flex-1 bg-surface-alt mt-1 min-h-[1.5rem]" />}
      </div>

      {/* Right: content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${textColor}`}>
            {label}
          </span>
          <span className="text-xs font-medium text-text-primary truncate">{entry.title}</span>
          <span className="ml-auto text-[10px] text-text-secondary flex-shrink-0">
            {relativeTime(entry.timestamp)}
          </span>
        </div>

        {entry.content && (
          <div className="mt-1">
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-[10px] text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
            >
              <span>{expanded ? '▾' : '▸'}</span>
              <span>{expanded ? 'hide details' : 'details'}</span>
            </button>
            {expanded && (
              <div className="mt-1.5 bg-surface border border-surface-alt rounded p-2 text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                {entry.content}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RunTimeline({ timeline }: RunTimelineProps) {
  const sorted = [...timeline].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="rounded-xl border border-surface-alt bg-surface-alt p-5">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Run History</h2>
        <span className="ml-auto text-[10px] text-text-secondary">{sorted.length} events</span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-text-secondary italic text-center py-4">
          No history yet — actions will appear here automatically.
        </p>
      ) : (
        <div>
          {sorted.map((entry, idx) => (
            <TimelineEntry key={entry.id} entry={entry} isLast={idx === sorted.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}
