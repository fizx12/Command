import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

import Projects from './pages/Projects';
import TaskBoard from './pages/TaskBoard';
import PromptBuilder from './pages/PromptBuilder';
import RunImporter from './pages/RunImporter';
import ReviewPanel from './pages/ReviewPanel';
import KnowledgeCenter from './pages/KnowledgeCenter';
import AgentLibrary from './pages/AgentLibrary';
import Settings from './pages/Settings';
import ProjectDetail from './pages/ProjectDetail';
import Sidebar from './components/layout/Sidebar';
import ProjectLayout from './components/layout/ProjectLayout';

type RunToast = {
  id: string;
  runId: string;
  taskTitle: string;
  summary?: string;
  projectId: string;
  taskId: string;
};

function RunReadyToast({ toasts, onDismiss, onReview }: {
  toasts: RunToast[];
  onDismiss: (id: string) => void;
  onReview: (toast: RunToast) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div key={t.id} className="bg-surface-alt border border-badge-green/40 rounded-xl shadow-xl p-4 flex flex-col gap-2 animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-badge-green flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-badge-green uppercase tracking-wider">Run Complete</p>
                <p className="text-sm font-semibold text-text-primary leading-tight">{t.taskTitle}</p>
                <p className="text-[11px] font-mono text-text-secondary">{t.runId}</p>
              </div>
            </div>
            <button onClick={() => onDismiss(t.id)} className="text-text-secondary hover:text-text-primary text-xs leading-none mt-0.5">✕</button>
          </div>
          {t.summary && (
            <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed pl-4">{t.summary}</p>
          )}
          <div className="flex gap-2 pl-4">
            <button
              onClick={() => { onReview(t); onDismiss(t.id); }}
              className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-bold hover:opacity-90 transition"
            >
              Review Now →
            </button>
            <button onClick={() => onDismiss(t.id)} className="px-3 py-1.5 bg-surface text-text-secondary rounded-lg text-xs font-medium hover:text-text-primary transition border border-surface-alt">
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [runToasts, setRunToasts] = useState<RunToast[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const activeProjectId = projectMatch ? projectMatch[1] : null;

  const dismissToast = useCallback((id: string) => {
    setRunToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const reviewToast = useCallback((toast: RunToast) => {
    navigate(`/projects/${toast.projectId}/review/${toast.taskId}`);
  }, [navigate]);

  useEffect(() => {
    window.api.onRunAutoImported((payload) => {
      if (payload.type === 'auto-imported') {
        const toast: RunToast = {
          id: `${payload.runId}-${Date.now()}`,
          runId: payload.runId as string,
          taskTitle: (payload.taskTitle as string) || (payload.taskId as string),
          summary: payload.summary as string | undefined,
          projectId: payload.projectId as string,
          taskId: payload.taskId as string,
        };
        setRunToasts(prev => [toast, ...prev].slice(0, 5)); // max 5 toasts
        // Auto-dismiss after 30 seconds
        setTimeout(() => dismissToast(toast.id), 30_000);
      }
    });
  }, [dismissToast]);

  return (
    <div className="flex h-screen w-screen bg-surface text-text-primary">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        activeProjectId={activeProjectId}
      />
      <RunReadyToast toasts={runToasts} onDismiss={dismissToast} onReview={reviewToast} />
      <main className="flex-1 overflow-auto flex flex-col">
        <Routes>
          {/* Home → project list */}
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/settings" element={<Settings />} />

          {/* All project sub-pages share the ProjectLayout (tab bar + project header) */}
          <Route path="/projects/:projectId" element={<ProjectLayout />}>
            <Route index element={<Navigate to="tasks" replace />} />
            <Route path="overview" element={<ProjectDetail />} />
            <Route path="tasks" element={<TaskBoard />} />
            <Route path="prompt-builder" element={<PromptBuilder />} />
            <Route path="runs" element={<RunImporter />} />
            <Route path="review/:taskId" element={<ReviewPanel />} />
            <Route path="knowledge" element={<KnowledgeCenter />} />
            <Route path="agents" element={<AgentLibrary />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppLayout />
    </HashRouter>
  );
}
