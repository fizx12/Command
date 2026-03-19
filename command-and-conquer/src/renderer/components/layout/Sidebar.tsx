import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useProject } from '../../hooks/useProjects';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeProjectId: string | null;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

const Icons = {
  menu: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />,
  projects: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />,
  tasks: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 012 2v2a2 2 0 01-2 2H9a2 2 0 01-2-2V7a2 2 0 002-2z" />,
  runs: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></>,
  prompt: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
  knowledge: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
  agents: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  settings: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>,
  back: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />,
};

const Icon: React.FC<{ d: React.ReactNode }> = ({ d }) => (
  <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {d}
  </svg>
);

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, activeProjectId }) => {
  const navigate = useNavigate();
  const { project } = useProject(activeProjectId || '');

  const NavItem = ({
    to, icon, label, end,
  }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors overflow-hidden group ${
          isActive
            ? 'bg-accent/15 text-accent'
            : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
        }`
      }
    >
      <div className="flex-shrink-0 flex items-center justify-center">{icon}</div>
      {!collapsed && <span className="text-sm font-medium whitespace-nowrap leading-none">{label}</span>}
    </NavLink>
  );

  return (
    <aside
      className={`h-screen bg-surface border-r border-surface-alt flex flex-col transition-all duration-200 flex-shrink-0 ${
        collapsed ? 'w-14' : 'w-52'
      }`}
    >
      {/* Brand + toggle */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-surface-alt flex-shrink-0 overflow-hidden">
        {!collapsed && (
          <span className="text-sm font-bold text-accent tracking-tight whitespace-nowrap select-none">
            Command &amp; Conquer
          </span>
        )}
        <button
          onClick={onToggle}
          className="ml-auto p-1.5 rounded-lg hover:bg-surface-alt text-text-secondary transition-colors flex-shrink-0"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <Icon d={Icons.menu} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto min-h-0">

        {/* Global nav */}
        <NavItem to="/projects" end icon={<Icon d={Icons.projects} />} label="Projects" />

        {/* Project section — only when a project is active */}
        {activeProjectId && (
          <>
            <div className={`mt-3 mb-1 ${collapsed ? 'mx-1 border-t border-surface-alt' : 'px-1'}`}>
              {!collapsed && (
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <button
                    onClick={() => navigate('/projects')}
                    className="text-text-secondary hover:text-text-primary transition-colors"
                    title="All projects"
                  >
                    <Icon d={Icons.back} />
                  </button>
                  <span
                    className="text-xs font-bold text-text-secondary uppercase tracking-widest truncate"
                    title={project?.name}
                  >
                    {project?.name ?? '…'}
                  </span>
                </div>
              )}
            </div>

            <NavItem
              to={`/projects/${activeProjectId}/overview`}
              icon={<Icon d={Icons.projects} />}
              label="Overview"
            />
            <NavItem
              to={`/projects/${activeProjectId}/tasks`}
              icon={<Icon d={Icons.tasks} />}
              label="Tasks"
            />
            <NavItem
              to={`/projects/${activeProjectId}/prompt-builder`}
              icon={<Icon d={Icons.prompt} />}
              label="Prompt Builder"
            />
            <NavItem
              to={`/projects/${activeProjectId}/runs`}
              icon={<Icon d={Icons.runs} />}
              label="Runs"
            />
            <NavItem
              to={`/projects/${activeProjectId}/knowledge`}
              icon={<Icon d={Icons.knowledge} />}
              label="Knowledge"
            />
            <NavItem
              to={`/projects/${activeProjectId}/agents`}
              icon={<Icon d={Icons.agents} />}
              label="Agents"
            />
          </>
        )}
      </nav>

      {/* Settings pinned bottom */}
      <div className="px-2 py-3 border-t border-surface-alt flex-shrink-0">
        <NavItem to="/settings" icon={<Icon d={Icons.settings} />} label="Settings" />
      </div>
    </aside>
  );
};

export default Sidebar;
