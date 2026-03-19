import { EntityId } from './common.types';

/** Agent execution mode. */
export type AgentMode = 'MAX' | 'WeakSAUCE';

/** Prompt compilation step — determines the goal and step instruction injected at end of prompt. */
export type PromptStep = 'plan' | 'implement';

/** Definition of a reusable agent role. */
export interface AgentDefinition {
  id: EntityId;
  name: string;
  role: string;
  mode: AgentMode;
  purpose: string;
  systemPrompt: string;
  requiredInputs: string[];
  outputFormat: string;
  checklist: string[];
  preferredModel: string;
  allowedActions: string[];
  active: boolean;
}
