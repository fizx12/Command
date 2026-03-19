import { create } from 'zustand';

interface AppState {
  activeProjectId: string | null;
  activeTaskId: string | null;
  anchorGateOpen: boolean;
  anchorGateTaskId: string | null;
  sidebarCollapsed: boolean;
  setActiveProject: (projectId: string | null) => void;
  setActiveTask: (taskId: string | null) => void;
  openAnchorGate: (taskId: string) => void;
  closeAnchorGate: () => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeProjectId: null,
  activeTaskId: null,
  anchorGateOpen: false,
  anchorGateTaskId: null,
  sidebarCollapsed: false,
  setActiveProject: (projectId) => set({ activeProjectId: projectId }),
  setActiveTask: (taskId) => set({ activeTaskId: taskId }),
  openAnchorGate: (taskId) => set({ anchorGateOpen: true, anchorGateTaskId: taskId }),
  closeAnchorGate: () => set({ anchorGateOpen: false, anchorGateTaskId: null }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
