import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../components/layout/Header';
import SearchBar from '../components/common/SearchBar';
import StatusPicker from '../components/common/StatusPicker';
import { useDocs, useSolvedIssues, useAnchors } from '../hooks/useKnowledge';
import { useProject, useRepos } from '../hooks/useProjects';
import DocCard from '../components/knowledge/DocCard';

const KnowledgeCenter: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { project } = useProject(projectId || '');
  const { repos } = useRepos(projectId || '');
  const { docs, loading: loadingDocs, refresh: refreshDocs } = useDocs(projectId || '');
  const { solvedIssues, loading: loadingIssues } = useSolvedIssues(projectId || '');
  const { anchors, loading: loadingAnchors } = useAnchors(projectId || '');

  const [activeTab, setActiveTab] = useState<'Documents' | 'Solved Issues' | 'Decisions'>('Documents');
  const [docFilter, setDocFilter] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState<{
    updated: string[];
    repoKnowledgePath: string;
    repoKnowledgeAbsolutePath: string;
    repoDocsPath: string;
  } | null>(null);
  const [bootstrapError, setBootstrapError] = useState('');
  const [buildingFullContext, setBuildingFullContext] = useState(false);
  const [fullContextResult, setFullContextResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const joinWindowsPath = (...parts: string[]): string => {
    const cleaned = parts
      .filter(Boolean)
      .map((part, index) => {
        const normalized = part.replace(/\//g, '\\');
        if (index === 0) {
          return normalized.replace(/[\\]+$/, '');
        }
        return normalized.replace(/^[\\]+|[\\]+$/g, '');
      });

    return cleaned.join('\\');
  };

  const filteredDocs = useMemo(() => {
    return docs.filter(doc => {
      if (docFilter === 'Stale') return doc.staleFlag;
      if (docFilter === 'Conflicting') return doc.conflictFlag;
      return true;
    });
  }, [docs, docFilter]);

  const filteredIssues = useMemo(() => {
    return solvedIssues.filter(issue => 
      issue.title.toLowerCase().includes(searchText.toLowerCase()) ||
      issue.symptom.toLowerCase().includes(searchText.toLowerCase()) ||
      issue.tags.some(tag => tag.toLowerCase().includes(searchText.toLowerCase()))
    );
  }, [solvedIssues, searchText]);

  const sortedAnchors = useMemo(() => {
    return [...anchors].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [anchors]);

  const staleCount = docs.filter(d => d.staleFlag).length;
  const activeRepo = project?.activeRepoId ? repos.find(repo => repo.id === project.activeRepoId) ?? null : null;
  const repoKnowledgePath = activeRepo ? joinWindowsPath(activeRepo.localPath, 'knowledge') : '';
  const repoKnowledgeAbsolutePath = bootstrapResult?.repoKnowledgeAbsolutePath || repoKnowledgePath;

  const getBootstrapDocCopies = () => {
    if (!bootstrapResult) {
      return [];
    }

    const wanted = new Set(
      bootstrapResult.updated.map((filename) => filename.replace(/\.md$/i, '').toLowerCase())
    );

    return docs.filter((doc) => {
      const baseName = String(doc.path || doc.id)
        .replace(/\\/g, '/')
        .split('/')
        .pop()
        ?.replace(/\.(md|json)$/i, '')
        .toLowerCase();
      return Boolean(baseName && wanted.has(baseName));
    });
  };

  const copyBootstrapDocs = async () => {
    const generatedDocs = getBootstrapDocCopies();
    if (generatedDocs.length === 0) {
      return;
    }

    const payload = generatedDocs
      .map((doc) => `=== FILE: ${doc.id}.md ===\n${doc.notes || ''}`)
      .join('\n\n');

    await navigator.clipboard.writeText(payload);
  };

  const handleBootstrap = async () => {
    if (!projectId) {
      setBootstrapError('No active project selected');
      return;
    }

    if (!activeRepo) {
      setBootstrapError('No selected repository is set for this project');
      return;
    }

    const sourcePath = activeRepo.localPath;

    // 1. Get API key from settings
    const settingsRes = await window.api.settings.get();
    const apiKey = settingsRes?.data?.openaiApiKey;
    if (!apiKey) {
      setBootstrapError('OpenAI API key not set - add it in Settings first');
      return;
    }

    // 2. Call bootstrap
    setBootstrapping(true);
    setBootstrapError('');
    setBootstrapResult(null);
    try {
      const res = await window.api.gemini.bootstrapKnowledge(projectId, sourcePath, apiKey);
      if (res?.error) {
        setBootstrapError(res.message || 'Bootstrap failed');
      } else {
        setBootstrapResult(res.data);
        await refreshDocs(projectId);
      }
    } finally {
      setBootstrapping(false);
    }
  };

  const handleBuildFullRepoContext = async () => {
    if (!projectId) {
      setFullContextResult({ ok: false, msg: 'No active project selected' });
      return;
    }

    if (!project?.activeRepoId) {
      setFullContextResult({ ok: false, msg: 'No selected repository is set for this project' });
      return;
    }

    if (!activeRepo) {
      setFullContextResult({ ok: false, msg: 'Selected repository could not be found in the project repository list' });
      return;
    }

    setBuildingFullContext(true);
    setFullContextResult(null);
    try {
      const res = await window.api.projects.buildFullRepoContext(projectId);
      if (res?.error) {
        setFullContextResult({ ok: false, msg: res.message || 'Failed to build full repo context' });
      } else {
        const snapshot = res.data;
        setFullContextResult({
          ok: true,
          msg: `Done - wrote FULL_REPO_CONTEXT.json (${snapshot?.snapshot?.summaryCounts?.includedFiles ?? 0} files, ${snapshot?.snapshot?.moduleList?.length ?? 0} modules)`,
        });
      }
    } catch {
      setFullContextResult({ ok: false, msg: 'Unexpected error building full repo context' });
    } finally {
      setBuildingFullContext(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-surface">
      <Header title="Knowledge" />

      <div className="px-6 border-b border-surface-alt">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {['Documents', 'Solved Issues', 'Decisions'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap relative ${
                activeTab === tab 
                  ? 'border-accent text-accent' 
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-alt/30'
              }`}
            >
              {tab}
              {tab === 'Documents' && staleCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-badge-yellow text-black text-[10px] font-bold px-1 rounded-full border border-surface">
                  {staleCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 p-6 overflow-auto">
        {activeTab === 'Documents' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
              <StatusPicker
                options={['All', 'Stale', 'Conflicting']}
                value={docFilter}
                onChange={setDocFilter}
              />
              <div className="flex flex-col items-end">
                <button
                  onClick={handleBootstrap}
                  disabled={bootstrapping}
                  className="px-4 py-2 bg-badge-green text-black rounded-lg font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {bootstrapping ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Bootstrapping...
                    </>
                  ) : (
                    <>Bootstrap Selected Repo</>
                  )}
                </button>
                <p className="text-xs italic text-text-secondary mt-1">Uses the currently selected repository, then refreshes this page after bootstrap</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Selected Repo</p>
                <p className="text-sm text-text-primary">
                  {activeRepo ? activeRepo.localPath : 'No selected repository'}
                </p>
                <p className="text-xs italic text-text-secondary mt-1">Bootstrap writes to this repo path first, and keeps the workspace mirror in sync.</p>
                <div className="mt-4 flex flex-col gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Knowledge Location</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (repoKnowledgeAbsolutePath) {
                          await window.api.system.openFolder(repoKnowledgeAbsolutePath);
                        }
                      }}
                      disabled={!repoKnowledgeAbsolutePath}
                      className="text-sm text-accent hover:text-text-primary transition-colors underline decoration-dotted underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50 text-left"
                      title={repoKnowledgeAbsolutePath || 'Run bootstrap first to open the repo knowledge folder'}
                    >
                      {repoKnowledgePath || 'repo-root\\knowledge'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (repoKnowledgePath) {
                          await navigator.clipboard.writeText(repoKnowledgePath);
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-surface-alt border border-surface text-[10px] font-bold uppercase text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs italic text-text-secondary">
                    This is the repo-root knowledge folder. The workspace mirror stays in sync too.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <button
                  onClick={handleBuildFullRepoContext}
                  disabled={buildingFullContext || !project?.activeRepoId}
                  className="px-4 py-2 bg-surface border border-accent/30 text-accent rounded-lg font-bold text-sm hover:border-accent/60 hover:text-text-primary transition-all disabled:opacity-50 flex items-center gap-2"
                  title="Run deterministic local analysis and write FULL_REPO_CONTEXT.json into project workspace storage"
                >
                  {buildingFullContext ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      Building Context...
                    </>
                  ) : (
                    <>Build Full Repo Context</>
                  )}
                </button>
                <p className="text-xs italic text-text-secondary mt-1">Deterministic local scan of the selected repository</p>
              </div>
            </div>

            {fullContextResult && (
              <div className={`p-3 rounded-lg text-sm ${fullContextResult.ok ? 'bg-badge-green/10 border border-badge-green/30 text-badge-green' : 'bg-badge-red/10 border border-badge-red/30 text-badge-red'}`}>
                {fullContextResult.ok ? 'OK ' : 'ERR '}{fullContextResult.msg}
              </div>
            )}

            {bootstrapError && (
              <div className="p-3 bg-badge-red/10 border border-badge-red/30 rounded-lg text-badge-red text-sm">
                {bootstrapError}
              </div>
            )}

            {bootstrapResult && (
              <div className="p-4 bg-badge-green/10 border border-badge-green/30 rounded-lg flex items-center justify-between">
                <div className="text-sm font-medium text-badge-green">
                  <p>Generated: {bootstrapResult.updated.join(', ')}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs opacity-80">
                    <span>Saved under:</span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (bootstrapResult.repoKnowledgeAbsolutePath) {
                          await window.api.system.openFolder(bootstrapResult.repoKnowledgeAbsolutePath);
                        }
                      }}
                      className="underline decoration-dotted underline-offset-4 hover:opacity-90 transition-opacity"
                      title={bootstrapResult.repoKnowledgeAbsolutePath}
                    >
                      {bootstrapResult.repoKnowledgePath}\\docs
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyBootstrapDocs}
                    disabled={getBootstrapDocCopies().length === 0}
                    className="px-3 py-1 rounded bg-badge-green text-black text-xs font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  >
                    Copy Docs
                  </button>
                  <button
                    onClick={() => setBootstrapResult(null)}
                    className="text-badge-green hover:opacity-70 transition-opacity text-lg leading-none"
                  >
                    x
                  </button>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredDocs.map(doc => (
                <DocCard
                  key={doc.id}
                  {...doc}
                  path={activeRepo ? joinWindowsPath(activeRepo.localPath, 'knowledge', 'docs', doc.path.split(/[/\\]/).pop() || doc.id) : doc.path}
                  onClick={() => {}}
                  onCopy={async () => {
                    await navigator.clipboard.writeText(doc.notes || '');
                  }}
                />
              ))}
              {filteredDocs.length === 0 && (
                <div className="col-span-full py-20 bg-surface-alt/50 rounded-xl border border-dashed border-surface-alt flex items-center justify-center">
                  <p className="text-text-secondary italic text-sm">No documents matching filter.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Solved Issues' && (
          <div className="flex flex-col gap-6">
            <SearchBar placeholder="Search symptoms, titles, or tags..." value={searchText} onChange={setSearchText} />
            
            <div className="flex flex-col gap-3">
              {filteredIssues.map(issue => (
                <div key={issue.id} className="bg-surface-alt rounded-lg p-5 border border-surface-alt hover:border-accent/40 transition-colors group">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-text-primary font-bold group-hover:text-accent transition-colors">{issue.title}</h3>
                    <div className="flex gap-2">
                      {issue.tags.map(tag => (
                        <span key={tag} className="bg-accent/10 text-accent text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary line-clamp-2">
                    <span className="font-bold text-text-primary opacity-50 mr-2 uppercase text-[10px]">Symptom:</span>
                    {issue.symptom}
                  </p>
                </div>
              ))}
              {filteredIssues.length === 0 && (
                <div className="py-20 bg-surface-alt/50 rounded-xl border border-dashed border-surface-alt flex items-center justify-center">
                  <p className="text-text-secondary italic text-sm">No solved issues found.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Decisions' && (
          <div className="flex flex-col gap-3">
            {sortedAnchors.map(anchor => (
              <div key={anchor.id} className="bg-surface-alt rounded-lg p-4 border border-surface-alt flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    anchor.status === 'Solved' ? 'bg-badge-green/20 text-badge-green' :
                    anchor.status === 'Broken' ? 'bg-badge-red/20 text-badge-red' :
                    'bg-badge-yellow/20 text-badge-yellow'
                  }`}>
                    {anchor.status}
                  </span>
                  <span className="text-[10px] font-mono text-text-secondary">
                    {new Date(anchor.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-text-primary leading-relaxed">
                  {anchor.summary}
                </p>
                {anchor.filesInPlay && anchor.filesInPlay.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1 pt-3 border-t border-surface/30">
                    {anchor.filesInPlay.map(file => (
                      <span key={file} className="text-[9px] font-mono bg-surface px-1.5 py-0.5 rounded text-text-secondary border border-surface-alt">
                        {file}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sortedAnchors.length === 0 && (
              <div className="py-20 bg-surface-alt/50 rounded-xl border border-dashed border-surface-alt flex items-center justify-center">
                <p className="text-text-secondary italic text-sm">No decisions recorded yet.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default KnowledgeCenter;



