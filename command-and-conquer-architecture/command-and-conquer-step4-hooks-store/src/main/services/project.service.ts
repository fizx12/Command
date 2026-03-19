import { FileStore } from '../storage/file-store';
import { Project, Repository, CreateProjectInput, UpdateProjectInput, CreateRepoInput } from '../types';
import * as crypto from 'crypto';

export class ProjectService {
  private fileStore: FileStore;

  constructor(fileStore: FileStore) {
    this.fileStore = fileStore;
  }

  async listProjects(): Promise<Project[]> {
    const projectDirs = await this.fileStore.listDirs('workspace/projects');
    const projects: Project[] = [];
    
    for (const dir of projectDirs) {
      if (dir.isDirectory) {
        try {
          const project = await this.fileStore.readJson<Project>(`workspace/projects/${dir.name}/overview/project.config.json`);
          if (project) {
            projects.push(project);
          }
        } catch (error) {
          // Ignore errors reading individual projects, continue to next
        }
      }
    }
    
    return projects;
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      return await this.fileStore.readJson<Project>(`workspace/projects/${id}/overview/project.config.json`);
    } catch {
      return null;
    }
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const id = 'proj-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    
    const project: Project = {
      id,
      name: input.name,
      description: input.description || '',
      repoLinks: [],
      activeRepoId: null,
      preferredTool: input.preferredTool || '',
      preferredModels: input.preferredModels || [],
      invariants: input.invariants || [],
      activeDocs: input.activeDocs || [],
      obsidianVaultPath: input.obsidianVaultPath || '',
      operationalPath: input.operationalPath || '',
      healthBadge: 'green',
      createdAt: now,
      updatedAt: now
    };

    // Ensure all required directories exist
    await this.fileStore.writeJson(`workspace/projects/${id}/overview/project.config.json`, project);
    
    // Create empty files/dirs to ensure the directory structure exists
    // The FileStore write method automatically creates parent directories
    await this.fileStore.writeMarkdown(`workspace/projects/${id}/tasks/.keep`, 'Keep file');
    await this.fileStore.writeMarkdown(`workspace/projects/${id}/runs/.keep`, 'Keep file');
    await this.fileStore.writeMarkdown(`workspace/projects/${id}/agents/.keep`, 'Keep file');
    await this.fileStore.writeMarkdown(`workspace/projects/${id}/conversations/.keep`, 'Keep file');
    await this.fileStore.writeMarkdown(`workspace/projects/${id}/conflicts/.keep`, 'Keep file');

    return project;
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
    const existing = await this.getProject(id);
    if (!existing) {
      throw new Error(`Project with ID ${id} not found`);
    }

    const updated: Project = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString()
    };

    await this.fileStore.writeJson(`workspace/projects/${id}/overview/project.config.json`, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<void> {
    await this.fileStore.deleteDir(`workspace/projects/${id}`);
  }

  async addRepo(input: CreateRepoInput): Promise<Repository> {
    const id = 'repo-' + crypto.randomUUID().slice(0, 8);
    
    const project = await this.getProject(input.projectId);
    if (!project) {
      throw new Error(`Project with ID ${input.projectId} not found`);
    }

    const repository: Repository = {
      id,
      projectId: input.projectId,
      localPath: input.localPath,
      remoteUrl: input.remoteUrl || '',
      defaultBranch: input.defaultBranch || 'main',
      provider: input.provider || '',
      notes: input.notes || ''
    };

    project.repoLinks.push(id);
    await this.updateProject(project.id, { repoLinks: project.repoLinks });
    
    await this.fileStore.writeJson(`workspace/projects/${input.projectId}/overview/repos/${id}.json`, repository);
    
    return repository;
  }

  async listRepos(projectId: string): Promise<Repository[]> {
    try {
      const files = await this.fileStore.listFiles(`workspace/projects/${projectId}/overview/repos`);
      const repos: Repository[] = [];
      
      for (const file of files) {
        if (file.name.endsWith('.json')) {
          try {
            const repo = await this.fileStore.readJson<Repository>(`workspace/projects/${projectId}/overview/repos/${file.name}`);
            if (repo) {
              repos.push(repo);
            }
          } catch {
            // Ignore individual read errors
          }
        }
      }
      
      return repos;
    } catch {
      // If the repos directory doesn't exist yet, return empty array
      return [];
    }
  }
}
