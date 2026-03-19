import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../components/layout/Header';
import SearchBar from '../components/common/SearchBar';
import StatusPicker from '../components/common/StatusPicker';
import { useDocs, useSolvedIssues, useAnchors } from '../hooks/useKnowledge';
import DocCard from '../components/knowledge/DocCard';

const KnowledgeCenter: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { docs, loading: loadingDocs } = useDocs(projectId || '');
  const { solvedIssues, loading: loadingIssues } = useSolvedIssues(projectId || '');
  const { anchors, loading: loadingAnchors } = useAnchors(projectId || '');

  const [activeTab, setActiveTab] = useState<'Documents' | 'Solved Issues' | 'Decisions'>('Documents');
  const [docFilter, setDocFilter] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState<{ updated: string[] } | null>(null);
  const [bootstrapError, setBootstrapError] = useState('');

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

  const handleBootstrap = async () => {
    // 1. Open folder picker to select source directory
    const folderRes = await window.api.settings.selectFolder();
    if (!folderRes?.data) return;
    const sourcePath = folderRes.data;

    // 2. Get API key from settings
    const settingsRes = await window.api.settings.get();
    const apiKey = settingsRes?.data?.openaiApiKey;
    if (!apiKey) {
      setBootstrapError('OpenAI API key not set — add it in Settings first');
      return;
    }

    // 3. Call bootstrap
    setBootstrapping(true);
    setBootstrapError('');
    setBootstrapResult(null);
    try {
      const res = await window.api.gemini.bootstrapKnowledge(projectId || '', sourcePath, apiKey);
      if (res?.error) {
        setBootstrapError(res.message || 'Bootstrap failed');
      } else {
        setBootstrapResult(res.data);
      }
    } finally {
      setBootstrapping(false);
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
                    <>⚡ Bootstrap Knowledge</>
                  )}
                </button>
                <p className="text-xs italic text-text-secondary mt-1">Reads your source code and generates context docs via GPT-4o mini</p>
              </div>
            </div>

            {bootstrapError && (
              <div className="p-3 bg-badge-red/10 border border-badge-red/30 rounded-lg text-badge-red text-sm">
                {bootstrapError}
              </div>
            )}

            {bootstrapResult && (
              <div className="p-4 bg-badge-green/10 border border-badge-green/30 rounded-lg flex items-center justify-between">
                <p className="text-sm font-medium text-badge-green">
                  Generated: {bootstrapResult.updated.join(', ')}
                </p>
                <button
                  onClick={() => setBootstrapResult(null)}
                  className="text-badge-green hover:opacity-70 transition-opacity text-lg leading-none"
                >
                  ×
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredDocs.map(doc => (
                <DocCard key={doc.id} {...doc} onClick={() => {}} />
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
