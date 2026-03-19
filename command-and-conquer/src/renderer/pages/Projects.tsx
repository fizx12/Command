import React, { useState } from 'react';
import Header from '../components/layout/Header';
import SearchBar from '../components/common/SearchBar';
import { useProjects, useCreateProject } from '../hooks/useProjects';
import HealthBadge from '../components/layout/HealthBadge';
import { useNavigate } from 'react-router-dom';

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const { projects, loading, refresh } = useProjects();
  const { create } = useCreateProject();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterText, setFilterText] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [preferredTool, setPreferredTool] = useState('');
  const [obsidianVaultPath, setObsidianVaultPath] = useState('');
  const [operationalPath, setOperationalPath] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    await create({
      name,
      description,
      preferredTool,
      obsidianVaultPath,
      operationalPath,
      preferredModels: [],
      invariants: [],
      activeDocs: []
    });
    setShowCreateForm(false);
    // Reset form
    setName('');
    setDescription('');
    setPreferredTool('');
    setObsidianVaultPath('');
    setOperationalPath('');
    refresh();
  };

  const selectFolder = async (setter: (val: string) => void) => {
    const response = await window.api.settings.selectFolder();
    if (response && !response.error && response.data) {
      setter(response.data);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(filterText.toLowerCase()) ||
    p.description.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-surface">
      <Header 
        title="Projects" 
        actions={
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-accent text-white rounded-lg font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-accent/20"
          >
            New Project
          </button>
        }
      />

      <main className="flex-1 p-6 overflow-auto space-y-6">
        <SearchBar 
          placeholder="Filter projects..." 
          value={filterText} 
          onChange={setFilterText} 
        />

        {showCreateForm && (
          <div className="bg-surface-alt rounded-xl p-6 border border-accent/20 shadow-xl animate-in slide-in-from-top duration-200 flex flex-col gap-4">
            <h3 className="font-bold text-text-primary">Create New Project</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Project Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="bg-surface text-text-primary p-2.5 rounded border border-surface outline-none focus:border-accent"
                  placeholder="e.g. My Awesome App"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Preferred Tool</label>
                <input
                  type="text"
                  value={preferredTool}
                  onChange={e => setPreferredTool(e.target.value)}
                  className="bg-surface text-text-primary p-2.5 rounded border border-surface outline-none focus:border-accent"
                  placeholder="e.g. haiku, sonnet-3.5"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="bg-surface text-text-primary p-2.5 rounded border border-surface outline-none focus:border-accent min-h-[80px] resize-none"
                placeholder="What is this project about?"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Obsidian Vault Path</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={obsidianVaultPath}
                    readOnly
                    className="flex-1 bg-surface text-text-primary p-2.5 rounded border border-surface outline-none text-sm truncate"
                  />
                  <button
                    onClick={() => selectFolder(setObsidianVaultPath)}
                    className="px-3 bg-surface-alt border border-surface hover:border-accent rounded text-xs font-medium"
                  >
                    Browse
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Operational Folder</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={operationalPath}
                    readOnly
                    className="flex-1 bg-surface text-text-primary p-2.5 rounded border border-surface outline-none text-sm truncate"
                  />
                  <button
                    onClick={() => selectFolder(setOperationalPath)}
                    className="px-3 bg-surface-alt border border-surface hover:border-accent rounded text-xs font-medium"
                  >
                    Browse
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="px-6 py-2 bg-accent text-white rounded-lg font-bold text-sm shadow-lg shadow-accent/20 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Project
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12 bg-surface-alt rounded-xl border border-dashed border-surface-alt text-text-secondary">
              No projects found matching "{filterText}"
            </div>
          ) : (
            filteredProjects.map(project => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="bg-surface-alt rounded-lg p-6 cursor-pointer hover:ring-2 hover:ring-accent transition-all flex items-center gap-6 group"
              >
                <HealthBadge status={project.healthBadge} />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-text-primary group-hover:text-accent transition-colors">
                    {project.name}
                  </h3>
                  <p className="text-sm text-text-secondary line-clamp-1">{project.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/projects/${project.id}/overview`);
                    }}
                    className="px-3 py-1.5 bg-surface hover:bg-surface-alt text-text-secondary hover:text-accent rounded border border-surface transition-all text-xs font-bold"
                  >
                    Overview
                  </button>
                  <span className="bg-surface px-2 py-1 rounded text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    {project.preferredTool}
                  </span>
                  <div className="text-right">
                    <p className="text-xs font-bold text-text-primary">{project.repoLinks?.length || 0} Repos</p>
                    <p className="text-[10px] text-text-secondary italic">Active</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Projects;
