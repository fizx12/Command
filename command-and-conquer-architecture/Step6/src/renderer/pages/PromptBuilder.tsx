import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTasks } from '../hooks/useTasks';
import PromptPreview from '../components/prompts/PromptPreview';
import ArtifactTailBlock from '../components/prompts/ArtifactTailBlock';
import Header from '../components/layout/Header';
import StatusPicker from '../components/common/StatusPicker';

type PromptMode = 'MAX' | 'WeakSAUCE';

type CompiledPromptResult = {
  compiledText: string;
  tokenEstimate?: number;
};

const AGENT_OPTIONS = [
  'planner_max',
  'implementer_max',
  'reviewer_max',
  'implementer_weaksauce',
] as const;

export default function PromptBuilder() {
  const { projectId = '' } = useParams();
  const { tasks = [] } = useTasks(projectId);

  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>(AGENT_OPTIONS[0]);
  const [selectedMode, setSelectedMode] = useState<PromptMode>('MAX');
  const [compiledPrompt, setCompiledPrompt] = useState<string>('');
  const [tokenEstimate, setTokenEstimate] = useState<number>(0);

  const selectedTask = useMemo(
    () => tasks.find((task: { id: string }) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  const handlePreview = async () => {
    if (!projectId || !selectedTaskId || !selectedAgentId) {
      return;
    }

    const result = (await window.api.prompts.preview(
      projectId,
      selectedTaskId,
      selectedAgentId
    )) as CompiledPromptResult | string | null;

    if (typeof result === 'string') {
      setCompiledPrompt(result);
      setTokenEstimate(0);
      return;
    }

    setCompiledPrompt(result?.compiledText ?? '');
    setTokenEstimate(result?.tokenEstimate ?? 0);
  };

  const handleCompileAndCopy = async () => {
    if (!projectId || !selectedTaskId || !selectedAgentId) {
      return;
    }

    const result = (await window.api.prompts.compile(
      projectId,
      selectedTaskId,
      selectedAgentId
    )) as CompiledPromptResult | string | null;

    const text = typeof result === 'string' ? result : result?.compiledText ?? '';
    const estimate = typeof result === 'string' ? 0 : result?.tokenEstimate ?? 0;

    setCompiledPrompt(text);
    setTokenEstimate(estimate);

    if (text) {
      await navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <Header title="Prompt Builder" />

      <div className="grid flex-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="rounded-lg border border-border bg-surface-alt p-5">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary">Task</label>
              <select
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none"
                value={selectedTaskId}
                onChange={(event) => setSelectedTaskId(event.target.value)}
              >
                <option value="">Select a task</option>
                {tasks.map((task: { id: string; title: string }) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary">Agent</label>
              <select
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none"
                value={selectedAgentId}
                onChange={(event) => setSelectedAgentId(event.target.value)}
              >
                {AGENT_OPTIONS.map((agentId) => (
                  <option key={agentId} value={agentId}>
                    {agentId}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-2 block text-sm font-medium text-text-primary">Mode</div>
              <div className="flex gap-2">
                {(['MAX', 'WeakSAUCE'] as PromptMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSelectedMode(mode)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      selectedMode === mode
                        ? 'bg-accent text-black'
                        : 'bg-surface text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 block text-sm font-medium text-text-primary">Task Status</div>
              <StatusPicker
                value={selectedTask?.status ?? 'backlog'}
                onChange={() => {}}
                options={['backlog', 'active', 'review', 'approved', 'done', 'blocked', 'archived']}
              />
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={handlePreview}
                className="rounded-md bg-surface px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={handleCompileAndCopy}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Compile &amp; Copy
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <div className="rounded-lg border border-border bg-surface-alt p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Preview</h2>
                <p className="text-sm text-text-secondary">
                  {selectedTask ? selectedTask.title : 'Select a task to preview a prompt'}
                </p>
              </div>
              <div className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
                {tokenEstimate} tokens
              </div>
            </div>
            <PromptPreview compiledText={compiledPrompt} tokenEstimate={tokenEstimate} />
          </div>

          <div className="rounded-lg border border-border bg-surface-alt p-5">
            <ArtifactTailBlock />
          </div>
        </div>
      </div>
    </div>
  );
}
