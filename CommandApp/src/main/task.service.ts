import { FileStore } from '../storage/file-store';
import { Task, CreateTaskInput, UpdateTaskInput, TaskStatus } from '../types';
import * as crypto from 'crypto';

export class TaskService {
  private fileStore: FileStore;

  constructor(fileStore: FileStore) {
    this.fileStore = fileStore;
  }

  async listTasks(projectId: string): Promise<Task[]> {
    try {
      const taskDirs = await this.fileStore.listDirs(`workspace/projects/${projectId}/tasks`);
      const tasks: Task[] = [];
      
      for (const dir of taskDirs) {
        if (dir.isDirectory && dir.name !== '.keep') {
          try {
            const task = await this.fileStore.readJson<Task>(`workspace/projects/${projectId}/tasks/${dir.name}/task_spec.json`);
            if (task) {
              tasks.push(task);
            }
          } catch {
            // Ignore errors reading individual tasks
          }
        }
      }
      return tasks;
    } catch {
      return [];
    }
  }

  async getTask(projectId: string, taskId: string): Promise<Task | null> {
    try {
      return await this.fileStore.readJson<Task>(`workspace/projects/${projectId}/tasks/${taskId}/task_spec.json`);
    } catch {
      return null;
    }
  }

  async createTask(projectId: string, input: CreateTaskInput): Promise<Task> {
    const id = 'TASK-' + String(Date.now()).slice(-6);
    const now = new Date().toISOString();
    
    const task: Task = {
      id,
      projectId,
      title: input.title,
      description: input.description,
      size: input.size,
      activeRepoId: input.activeRepoId,
      status: 'backlog',
      resolution: '',
      priority: input.priority || 0,
      scope: input.scope || '',
      outOfScope: input.outOfScope || '',
      mustPreserve: input.mustPreserve || [],
      activePhase: 'created',
      linkedRunIds: [],
      linkedDocIds: input.linkedDocIds || [],
      decisionAnchorId: null,
      createdAt: now,
      updatedAt: now
    };

    await this.fileStore.writeJson(`workspace/projects/${projectId}/tasks/${id}/task_spec.json`, task);
    return task;
  }

  async updateTask(projectId: string, taskId: string, input: UpdateTaskInput): Promise<Task> {
    const existing = await this.getTask(projectId, taskId);
    if (!existing) {
      throw new Error(`Task with ID ${taskId} not found in project ${projectId}`);
    }

    const updated: Task = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString()
    };

    await this.fileStore.writeJson(`workspace/projects/${projectId}/tasks/${taskId}/task_spec.json`, updated);
    return updated;
  }

  async listTasksByStatus(projectId: string, status: TaskStatus): Promise<Task[]> {
    const allTasks = await this.listTasks(projectId);
    return allTasks.filter(task => task.status === status);
  }

  async getTasksInReviewOlderThan(projectId: string, hours: number): Promise<Task[]> {
    const allTasks = await this.listTasks(projectId);
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return allTasks.filter(task => {
      if (task.status !== 'review') return false;
      const updatedDate = new Date(task.updatedAt);
      return updatedDate < cutoffDate;
    });
  }
}
