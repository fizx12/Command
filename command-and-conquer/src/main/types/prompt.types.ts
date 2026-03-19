import { EntityId } from './common.types';
import { AgentMode, PromptStep } from './agent.types';

/** Saved prompt configuration profile. */
export interface PromptProfile {
  id: EntityId;
  projectId: EntityId;
  name: string;
  mode: AgentMode;
  includedDocs: EntityId[];
  includedCheatSheets: EntityId[];
  outputTemplate: string;
  artifactTailEnabled: boolean;
  notes: string;
}

/** Ordered stack of prompt sections used for compilation. */
export interface PromptStack {
  globalRules: string;
  masterPromptShell: string;
  projectPrimer: string;
  sourceOfTruthIndex: string;
  selectedCheatSheets: string[];
  taskSpec: string;
  plannerOutput: string;
  carryForwardNotes: string;
  decisionAnchorContext: string;
  roleInstructions: string;
  outputFormat: string;
  artifactTail: string;
}

/** Fully compiled prompt ready to send to an external coder. */
export interface CompiledPrompt {
  id: EntityId;
  projectId: EntityId;
  taskId: EntityId;
  agentId: EntityId; // kept for backward compat; set to step value at compile time
  step: PromptStep;
  mode: AgentMode;
  compiledText: string;
  tokenEstimate: number;
  createdAt: string;
}
