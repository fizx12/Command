import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/layout/Header';
import HealthBadge from '../components/layout/HealthBadge';
import { useProject, useUpdateProject, useRepos, useAddRepo } from '../hooks/useProjects';
import { useAppStore } from '../stores/app.store';
import { Repository } from '../../main/types';

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { project, loading, error, refresh: refreshProject } = useProject(projectId || '');
  const { update: updateProject } = useUpdateProject();
  const { repos, refresh: refreshRepos } = useRepos(projectId || '');
  const { addRepo } = useAddRepo();
  const setActiveProject = useAppStore(state => state.setActiveProject);

  // Repo context generation
  const [generatingContext, setGeneratingContext] = useState(false);
  const [contextResult, setContextResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Determine active tab from current URL path
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.endsWith('/tasks')) return 'tasks';
    if (path.endsWith('/prompt-builder')) return 'prompt-builder';
    if (path.endsWith('/runs')) return 'runs';
    if (path.endsWith('/knowledge')) return 'knowledge';
    if (path.endsWith('/agents')) return 'agents';
    if (path.endsWith('/overview')) return 'overview';
    return 'overview';
  };

  const activeTab = getActiveTab();

  const handleRepoChange = async (repoId: string) => {
    if (!projectId) return;
    try {
      await updateProject(projectId, { activeRepoId: repoId || null });
      refreshProject();
    } catch (err) {
      console.error('Failed to update repository:', err);
    }
  };

  const handleGenerateContext = async () => {
    if (!projectId || !project?.activeRepoId) return;
    const activeRepo = repos.find(r => r.id === project.activeRepoId);
    if (!activeRepo) return;
    const settingsRes = await window.api.settings.get();
    const apiKey = settingsRes?.data?.openaiApiKey || '';
    if (!apiKey) {
      setContextResult({ ok: false, msg: 'No OpenAI API key — add it in Settings first' });
      return;
    }
    setGeneratingContext(true);
    setContextResult(null);
    try {
      const res = await window.api.gemini.generateRepoContext(projectId, activeRepo.localPath, apiKey);
      if (res?.error) {
        setContextResult({ ok: false, msg: res.message || 'Failed to generate context' });
      } else {
        setContextResult({ ok: true, msg: `Done — ${res.data.filesScanned} files scanned` });
      }
    } catch {
      setContextResult({ ok: false, msg: 'Unexpected error generating context' });
    } finally {
      setGeneratingContext(false);
    }
  };

  const handleAddRepo = async () => {
    if (!projectId) return;
    try {
      const result = await window.api.settings.selectFolder();
      if (result.error || !result.data) return;
      
      const localPath = result.data;
      await addRepo({ projectId, localPath });
      
      refreshRepos();
      refreshProject();
    } catch (err) {
      console.error('Failed to add repository:', err);
    }
  };

  useEffect(() => {
    if (projectId) {
      setActiveProject(projectId);
    }
    return () => setActiveProject(null);
  }, [projectId, setActiveProject]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-full bg-surface">
        <Header title="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex-1 flex flex-col h-full bg-surface text-text-primary p-6">
        <Header title="Project Not Found" />
        <div className="bg-badge-red/10 border border-badge-red/30 p-4 rounded-lg mt-6 text-badge-red">
          <p className="text-sm">{error || "The requested project could not be found."}</p>
          <Link to="/" className="text-sm underline mt-2 inline-block">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview',        label: 'Overview',        path: `/projects/${projectId}` },
    { id: 'tasks',           label: 'Tasks',           path: `/projects/${projectId}/tasks` },
    { id: 'prompt-builder',  label: 'Prompt Builder',  path: `/projects/${projectId}/prompt-builder` },
    { id: 'runs',            label: 'Runs',            path: `/projects/${projectId}/runs` },
    { id: 'knowledge',       label: 'Knowledge',       path: `/projects/${projectId}/knowledge` },
    { id: 'agents',          label: 'Agents',          path: `/projects/${projectId}/agents` },
  ] as const;

  return (
    <div className="flex-1 flex flex-col h-full bg-surface">
      <Header 
        title={project.name} 
        subtitle={project.description}
        actions={
          <div className="flex items-center gap-4">
            <HealthBadge status={project.healthBadge} />
            <button className="p-2 hover:bg-surface-alt rounded-lg text-text-secondary transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        }
      />

      {/* Tab bar — always visible, uses navigate() not window.location.hash */}
      <div className="px-6 border-b border-surface-alt flex-shrink-0">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-alt/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview content — only shown when on the overview tab */}
      {activeTab === 'overview' && (
        <main className="flex-1 p-6 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface-alt rounded-xl p-6 flex flex-col gap-4 border border-surface-alt">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Project Control</h3>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-text-secondary">Active Repository</label>
                <div className="flex gap-2">
                  <select 
                    className="flex-1 bg-surface text-text-primary p-2 rounded border border-surface outline-none focus:border-accent text-sm"
                    value={project.activeRepoId || ''}
                    onChange={(e) => handleRepoChange(e.target.value)}
                  >
                    <option value="">Select a repository...</option>
                    {repos.map(repo => (
                      <option key={repo.id} value={repo.id}>
                        {repo.localPath.split(/[/\\]/).pop()} ({repo.id})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddRepo}
                    className="px-3 py-2 bg-accent/10 text-accent hover:bg-accent/20 rounded border border-accent/20 transition-colors text-sm font-bold"
                    title="Add local repository"
                  >
                    Add
                  </button>
                </div>

                {/* Generate repo context — scans relevant files, builds compact context via gpt-4o-mini */}
                {project?.activeRepoId && (
                  <div className="flex flex-col gap-1 mt-2">
                    <button
                      onClick={handleGenerateContext}
                      disabled={generatingContext}
                      title="Scan repo files and generate a compact REPO CONTEXT block via gpt-4o-mini — injected into all compiled prompts"
                      className="flex items-center gap-2 px-3 py-2 bg-surface border border-surface-alt hover:border-accent/40 rounded text-xs font-bold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 w-fit"
                    >
                      {generatingContext
                        ? <><span className="w-3 h-3 border-2 border-text-secondary/30 border-t-text-secondary rounded-full animate-spin" /> Scanning repo...</>
                        : '⚡ Generate Repo Context'}
                    </button>
                    {contextResult && (
                      <p className={`text-[10px] font-medium ${contextResult.ok ? 'text-badge-green' : 'text-badge-red'}`}>
                        {contextResult.ok ? '✓ ' : '✗ '}{contextResult.msg}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-4">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Project Invariants</h4>
                <div className="flex flex-col gap-2">
                  {project.invariants.length > 0 ? (
                    project.invariants.map((inv, idx) => (
                      <div key={idx} className="bg-surface p-3 rounded text-sm text-text-primary border border-surface">
                        {inv}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-text-secondary italic">No invariants defined.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-surface-alt rounded-xl p-6 border border-surface-alt">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Quick Links</h3>
              <div className="flex flex-col gap-2">
                {tabs.filter(t => t.id !== 'overview').map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => navigate(tab.path)}
                    className="text-left px-4 py-3 bg-surface rounded-lg text-sm text-text-primary hover:border-accent border border-surface transition-colors"
                  >
                    {tab.label} →
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Non-overview tabs render nothing here — the route handles it */}
      {/* But we keep the tab bar mounted so it stays visible */}
    </div>
  );
};

export default ProjectDetail;
