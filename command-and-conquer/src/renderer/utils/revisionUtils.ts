/**
 * Utilities for managing revision state and preserving prompt generator data
 * across task editing navigation and sessions.
 */

import { TaskMode } from '../../main/types/prompt.types';

const PROMPT_STATES_KEY = 'command_and_conquer_prompt_states_v3';

export interface PromptHistoryEntry {
  compiled: string;
  tightened: string;
  timestamp: number;
  mode: string;
  taskMode: TaskMode;
  targetCoder: string;
  label: string; // e.g. "Initial Compile", "Tightened", "Architect Plan"
}

export interface PromptState {
  projectId: string;
  taskId: string;
  mode: 'MAX' | 'WeakSAUCE';
  taskMode: TaskMode;
  targetCoder: '5.4mini' | 'flash';
  step: string;
  compiledPrompt: string;
  tightenedPrompt: string;
  appliedLevel: string;
  applyReason: string;
  applyEnhancements: string;
  timestamp: number;
  history: PromptHistoryEntry[];
}

/**
 * Saves the current generator state into a persistent map by projectId and taskId.
 */
export function savePromptState(projectId: string, taskId: string, state: Partial<PromptState>): void {
  if (!projectId || !taskId) return;
  try {
    const raw = localStorage.getItem(PROMPT_STATES_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const key = `${projectId}:${taskId}`;
    
    // Ensure history is preserved if passing partial state
    const existing = map[key] || { history: [] };
    
    map[key] = {
      ...existing,
      ...state,
      projectId,
      taskId,
      timestamp: Date.now(),
      history: state.history || existing.history || []
    };

    // Keep the map from growing indefinitely - clear entries older than 30 days
    const now = Date.now();
    const expiry = 30 * 24 * 60 * 60 * 1000;
    const cleaned: Record<string, any> = {};
    Object.keys(map).forEach(k => {
      if (now - map[k].timestamp < expiry) {
        cleaned[k] = map[k];
      }
    });

    localStorage.setItem(PROMPT_STATES_KEY, JSON.stringify(cleaned));
  } catch (err) {
    console.error('Failed to save prompt state:', err);
  }
}

/**
 * Retrieves the saved generator state for a specific project/task context.
 */
export function getPromptState(projectId: string, taskId: string): PromptState | null {
  if (!projectId || !taskId) return null;
  try {
    const raw = localStorage.getItem(PROMPT_STATES_KEY);
    if (!raw) return null;

    const map = JSON.parse(raw);
    const key = `${projectId}:${taskId}`;
    const value = map[key];

    if (value && value.projectId === projectId && value.taskId === taskId) {
      if (!value.history) value.history = [];
      return value as PromptState;
    }
  } catch (err) {
    console.error('Failed to load prompt state:', err);
  }
  return null;
}

/**
 * Log a specific prompt generation event to the task's history.
 */
export function logPromptEvent(
  projectId: string, 
  taskId: string, 
  entry: Omit<PromptHistoryEntry, 'timestamp'>
): void {
  const currentState = getPromptState(projectId, taskId);
  const history = currentState?.history || [];
  
  // Add new entry, keep last 20 entries
  const newHistory = [
    { ...entry, timestamp: Date.now() },
    ...history
  ].slice(0, 20);

  savePromptState(projectId, taskId, { history: newHistory });
}

/**
 * Clears the saved prompt state for a specific project/task context.
 */
export function clearPromptState(projectId: string, taskId: string): void {
  if (!projectId || !taskId) return;
  try {
    const raw = localStorage.getItem(PROMPT_STATES_KEY);
    if (!raw) return;
    const map = JSON.parse(raw);
    delete map[`${projectId}:${taskId}`];
    localStorage.setItem(PROMPT_STATES_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to clear prompt state:', err);
  }
}
