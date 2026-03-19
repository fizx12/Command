import { EntityId, ISODateString, HealthBadge } from './common.types';

/** Project definition for a Command and Conquer workspace. */
export interface Project {
  id: EntityId;
  name: string;
  description: string;
  repoLinks: EntityId[];
  activeRepoId: EntityId | null;
  preferredTool: string;
  preferredModels: string[];
  invariants: string[];
  activeDocs: EntityId[];
  obsidianVaultPath: string;
  operationalPath: string;
  healthBadge: HealthBadge;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Repository record associated with a project. */
export interface Repository {
  id: EntityId;
  projectId: EntityId;
  localPath: string;
  remoteUrl: string;
  defaultBranch: string;
  provider: string;
  notes: string;
}

/** Input payload for creating a project. */
export interface CreateProjectInput {
  name: string;
  description: string;
  preferredTool: string;
  preferredModels: string[];
  invariants: string[];
  activeDocs: EntityId[];
  obsidianVaultPath: string;
  operationalPath: string;
}

/** Input payload for updating a project. */
export interface UpdateProjectInput {
  name?: string;
  description?: string;
  repoLinks?: EntityId[];
  activeRepoId?: EntityId | null;
  preferredTool?: string;
  preferredModels?: string[];
  invariants?: string[];
  activeDocs?: EntityId[];
  obsidianVaultPath?: string;
  operationalPath?: string;
}

/** Input payload for creating a repository. */
export interface CreateRepoInput {
  projectId: EntityId;
  localPath: string;
  remoteUrl: string;
  defaultBranch: string;
  provider: string;
  notes: string;
}
