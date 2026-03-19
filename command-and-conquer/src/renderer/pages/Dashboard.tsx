import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import HealthBadge from '../components/layout/HealthBadge';
import { useProjects } from '../hooks/useProjects';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { projects, loading, error } = useProjects();

  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-full bg-surface">
        <Header title="Dashboard" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col h-full bg-surface text-text-primary p-6">
        <Header title="Dashboard" />
        <div className="bg-badge-red/10 border border-badge-red/30 p-4 rounded-lg mt-6 text-badge-red">
          <h3 className="font-bold">Error loading projects</h3>
          <p className="text-sm opacity-90">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-surface">
      <Header title="Dashboard" />
      
      <main className="flex-1 p-6 overflow-auto">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-surface-alt rounded-xl border border-dashed border-surface-alt">
            <p className="text-text-secondary mb-6 text-lg">No projects yet. Create one to get started.</p>
            <button
              onClick={() => navigate('/projects')}
              className="px-6 py-2 bg-accent text-white rounded-lg font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20"
            >
              Go to Projects
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="bg-surface-alt rounded-lg p-6 cursor-pointer hover:ring-2 hover:ring-accent transition-all flex flex-col gap-4 group"
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-lg text-text-primary group-hover:text-accent transition-colors">
                    {project.name}
                  </h3>
                  <HealthBadge status={project.healthBadge} />
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <span className="bg-surface px-2 py-1 rounded text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {project.preferredTool}
                  </span>
                  <span className="bg-accent/10 px-2 py-1 rounded text-xs font-medium text-accent">
                    {project.repoLinks?.length || 0} repos
                  </span>
                </div>

                <div className="mt-auto pt-4 border-t border-surface/30">
                  <span className="text-[10px] text-text-secondary uppercase font-bold tracking-[0.1em]">
                    Active Tasks Placeholder
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
