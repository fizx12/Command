import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useAppStore } from '../../stores/app.store';

/**
 * Thin layout wrapper for all /projects/:projectId/* routes.
 * Responsibilities:
 *   1. Set the active project in the global store (so Sidebar can highlight it)
 *   2. Render <Outlet /> — all navigation is handled by the sidebar
 */
const ProjectLayout: React.FC = () => {
  const { projectId = '' } = useParams();
  const setActiveProject = useAppStore(state => state.setActiveProject);

  React.useEffect(() => {
    if (projectId) setActiveProject(projectId);
    return () => setActiveProject(null);
  }, [projectId, setActiveProject]);

  return (
    <div className="flex flex-col h-full bg-surface overflow-hidden">
      <Outlet />
    </div>
  );
};

export default ProjectLayout;
