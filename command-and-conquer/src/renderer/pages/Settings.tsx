import React, { useState, useEffect } from 'react';
import Header from '../components/layout/Header';

interface SettingsData {
  obsidianVaultPath: string;
  hubPath: string;
  watchFolders: string[];
  defaultModel: string;
  theme: 'dark';
  openaiApiKey: string;
  flashModel: string;
  proModel: string;
  taskOptimizerModel: string;
  bootstrapModel: string;
  revisionModel: string;
  geminiEnabled: boolean;
  geminiApiKey: string;
  geminiFlashModel: string;
  geminiProModel: string;
}

interface ModelOption {
  id: string;
  name: string;
  shortUse: string;
  longUse: string;
}

type KeyTestState = 'idle' | 'testing' | 'ok' | 'error';

const OPTIMIZER_MODELS: ModelOption[] = [
  {
    id: 'gpt-5.4-nano',
    name: 'GPT-5.4 Nano',
    shortUse: 'Cheapest for scanning, tagging, and doc cleanup.',
    longUse: 'Use when the task is mostly extraction, organization, or lightweight rewriting with very low reasoning demand.',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    shortUse: 'Balanced cheap default for routine optimizer work.',
    longUse: 'Good for simple prompt tightening, small summaries, and predictable structured output.',
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    shortUse: 'Stronger reasoning while staying cost-conscious.',
    longUse: 'Use for light refactors, sharper prompt optimization, and tasks that need better judgment without paying for a larger model.',
  },
  {
    id: 'gpt-5.1-codex-mini',
    name: 'GPT-5.1 Codex Mini',
    shortUse: 'Best cheap code-first option for repo work.',
    longUse: 'Use when the optimizer needs to understand code structure, file relationships, or produce developer-oriented guidance.',
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    shortUse: 'Ultra-cheap for the simplest scans and labels.',
    longUse: 'Best when speed and low cost matter more than reasoning depth and the task is already very constrained.',
  },
];

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [obsidianVaultPath, setObsidianVaultPath] = useState('');
  const [hubPath, setHubPath] = useState('');
  const [watchFolders, setWatchFolders] = useState<string[]>([]);

  // OpenAI (primary)
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [flashModel, setFlashModel] = useState('gpt-4o-mini');
  const [proModel, setProModel] = useState('gpt-5.4');
  const [taskOptimizerModel, setTaskOptimizerModel] = useState('gpt-4o-mini');
  const [bootstrapModel, setBootstrapModel] = useState('gpt-5-nano');
  const [revisionModel, setRevisionModel] = useState('gpt-4o-mini');
  const [modelInfoKey, setModelInfoKey] = useState<string | null>(null);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [openaiTestState, setOpenaiTestState] = useState<KeyTestState>('idle');
  const [openaiTestError, setOpenaiTestError] = useState('');

  // Gemini (disabled by default)
  const [geminiEnabled, setGeminiEnabled] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiFlashModel, setGeminiFlashModel] = useState('gemini-2.0-flash');
  const [geminiProModel, setGeminiProModel] = useState('gemini-1.5-pro');
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  useEffect(() => {
    window.api.settings.get().then((response) => {
      if (response && !response.error && response.data) {
        const s = response.data as SettingsData;
        setObsidianVaultPath(s.obsidianVaultPath || '');
        setHubPath(s.hubPath || '');
        setWatchFolders(s.watchFolders || []);
        setOpenaiApiKey(s.openaiApiKey || '');
        setFlashModel(s.flashModel || 'gpt-4o-mini');
        setProModel(s.proModel || 'gpt-5.4');
        setTaskOptimizerModel(s.taskOptimizerModel || 'gpt-4o-mini');
        setBootstrapModel(s.bootstrapModel || 'gpt-5-nano');
        setRevisionModel(s.revisionModel || 'gpt-4o-mini');
        setGeminiEnabled(!!s.geminiEnabled);
        setGeminiApiKey(s.geminiApiKey || '');
        setGeminiFlashModel(s.geminiFlashModel || 'gemini-2.0-flash');
        setGeminiProModel(s.geminiProModel || 'gemini-1.5-pro');
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSelectFolder = async (setter: (path: string) => void) => {
    const response = await window.api.settings.selectFolder();
    if (response && !response.error && response.data) setter(response.data);
  };

  const handleAddWatchFolder = async () => {
    const response = await window.api.settings.selectFolder();
    if (response && !response.error && response.data) {
      const p = response.data;
      if (!watchFolders.includes(p)) setWatchFolders([...watchFolders, p]);
    }
  };

  const handleTestOpenaiKey = async () => {
    if (!openaiApiKey.trim()) { setOpenaiTestError('Enter an API key first'); setOpenaiTestState('error'); return; }
    setOpenaiTestState('testing');
    setOpenaiTestError('');
    try {
      const response = await window.api.gemini.testKey(openaiApiKey);
      setOpenaiTestState(response && !response.error ? 'ok' : 'error');
      if (response?.error) setOpenaiTestError(response.message || 'Invalid key');
    } catch {
      setOpenaiTestState('error');
      setOpenaiTestError('Failed to test key');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.api.settings.update({
        obsidianVaultPath, hubPath, watchFolders,
        openaiApiKey, flashModel, proModel,
        taskOptimizerModel, bootstrapModel, revisionModel,
        geminiEnabled, geminiApiKey, geminiFlashModel, geminiProModel,
        theme: 'dark',
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderModelPicker = (
    title: string,
    description: string,
    selectedModel: string,
    setSelectedModel: (model: string) => void,
    slot: string
  ) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-bold text-text-secondary uppercase">
          {title}
          <span className="ml-1 font-normal normal-case text-text-secondary/60">{description}</span>
        </label>
        <button
          type="button"
          onClick={() => setModelInfoKey(modelInfoKey ? null : `${slot}:${selectedModel}`)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-surface-alt bg-surface-alt text-[11px] font-bold text-text-secondary hover:border-accent hover:text-accent transition-colors"
          title="Show model guidance"
          aria-label={`Show ${title} guidance`}
        >
          i
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {OPTIMIZER_MODELS.map((model) => {
          const active = selectedModel === model.id;
          const expanded = modelInfoKey === `${slot}:${model.id}`;
          return (
            <div
              key={`${slot}-${model.id}`}
              className={`rounded-lg border p-3 transition-colors ${active ? 'border-accent bg-accent/10' : 'border-surface-alt bg-surface-alt/40'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedModel(model.id)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-text-primary">{model.name}</span>
                    {active && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">Selected</span>}
                  </div>
                  <p className="mt-1 text-[11px] text-text-secondary">{model.shortUse}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setModelInfoKey(expanded ? null : `${slot}:${model.id}`)}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-surface-alt bg-surface text-[11px] font-bold text-text-secondary hover:border-accent hover:text-accent transition-colors"
                  title="Best use case"
                  aria-label={`Best use case for ${model.name}`}
                >
                  i
                </button>
              </div>
              {expanded && (
                <p className="mt-2 text-[11px] leading-5 text-text-secondary">
                  {model.longUse}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-full bg-surface">
        <Header title="Settings" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-surface">
      <Header title="Settings" />

      <main className="flex-1 p-8 overflow-auto max-w-4xl">
        <div className="flex flex-col gap-10">

          {/* Storage Paths */}
          <section className="flex flex-col gap-6">
            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest border-b border-surface-alt pb-2">Storage Paths</h2>
            <div className="flex flex-col gap-4">
              <PathField label="Obsidian Vault Path" value={obsidianVaultPath} onChange={setObsidianVaultPath} onBrowse={() => handleSelectFolder(setObsidianVaultPath)} placeholder="/path/to/vault" />
              <div className="flex flex-col gap-2">
                <PathField label="Run Hub Path" value={hubPath} onChange={setHubPath} onBrowse={() => handleSelectFolder(setHubPath)} placeholder="e.g. C:\Users\G\Documents\Command\.c2" />
                <p className="text-[10px] text-text-secondary italic pl-1">
                  Single folder where ALL run artifacts land. Runs write to: <span className="font-mono">{hubPath ? `${hubPath}\\runs\\{project}\\{runId}\\` : '{hubPath}\\runs\\{project}\\{runId}\\'}</span>
                </p>
              </div>
            </div>
          </section>

          {/* OpenAI API — primary */}
          <section className="flex flex-col gap-6">
            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest border-b border-surface-alt pb-2">
              OpenAI API
              <span className="ml-2 text-accent font-bold normal-case tracking-normal text-xs">(primary)</span>
            </h2>
            <div className="flex flex-col gap-4">

              {/* API Key */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase">API Key</label>
                <div className="flex gap-2">
                  <input
                    type={showOpenaiKey ? 'text' : 'password'}
                    value={openaiApiKey}
                    onChange={e => setOpenaiApiKey(e.target.value)}
                    className="flex-1 bg-surface-alt text-text-primary p-2.5 rounded border border-surface-alt outline-none focus:border-accent text-sm"
                    placeholder="sk-..."
                  />
                  <button onClick={() => setShowOpenaiKey(!showOpenaiKey)} className="px-3 py-2 bg-surface-alt hover:bg-surface border border-surface-alt rounded text-text-primary transition-colors">
                    <EyeIcon visible={showOpenaiKey} />
                  </button>
                  <button
                    onClick={handleTestOpenaiKey}
                    disabled={openaiTestState === 'testing'}
                    className="px-4 py-2 bg-surface-alt hover:bg-surface border border-surface-alt rounded text-xs font-bold text-text-primary transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {openaiTestState === 'testing'
                      ? <><div className="w-3 h-3 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin" /> Testing...</>
                      : 'Test Key'}
                  </button>
                </div>
                {openaiTestState === 'ok' && <p className="text-xs text-badge-green font-semibold">✓ Connected</p>}
                {openaiTestState === 'error' && openaiTestError && <p className="text-xs text-badge-red font-semibold">✗ {openaiTestError}</p>}
                <p className="text-[10px] text-text-secondary italic">Used for prompt tightening, bootstrap knowledge, and run evaluation.</p>
              </div>

              {/* Task-specific model selectors */}
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Task-Specific Models</h3>
                  <p className="text-[10px] text-text-secondary italic">
                    These settings control the task optimizer, revision tighten, and knowledge bootstrap paths.
                  </p>
                </div>
                {renderModelPicker('Task Optimizer', 'task optimizer + tighten', taskOptimizerModel, setTaskOptimizerModel, 'task-optimizer')}
                {renderModelPicker('Bootstrap Knowledge', 'repo scanning + doc synthesis', bootstrapModel, setBootstrapModel, 'bootstrap')}
                {renderModelPicker('Revision Tighten', 'revision prompt tightening', revisionModel, setRevisionModel, 'revision')}
              </div>

              {/* Legacy prompt-gen / general model selectors */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-text-secondary uppercase">
                    Flash Model
                    <span className="ml-1 font-normal normal-case text-text-secondary/60">- legacy prompt-gen tighten</span>
                  </label>
                  <select
                    value={flashModel}
                    onChange={e => setFlashModel(e.target.value)}
                    className="bg-surface-alt text-text-primary p-2.5 rounded border border-surface-alt outline-none focus:border-accent text-sm"
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini ($0.15/$0.60/M)</option>
                    <option value="gpt-5.4-mini">gpt-5.4-mini ($0.75/$4.50/M)</option>
                    <option value="gpt-4o">gpt-4o ($2.50/$10.00/M)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-text-secondary uppercase">
                    Pro Model
                    <span className="ml-1 font-normal normal-case text-text-secondary/60">- smart tasks</span>
                  </label>
                  <select
                    value={proModel}
                    onChange={e => setProModel(e.target.value)}
                    className="bg-surface-alt text-text-primary p-2.5 rounded border border-surface-alt outline-none focus:border-accent text-sm"
                  >
                    <option value="gpt-5.4">gpt-5.4 ($2.50/$15.00/M)</option>
                    <option value="gpt-5.4-mini">gpt-5.4-mini ($0.75/$4.50/M)</option>
                    <option value="gpt-4o">gpt-4o ($2.50/$10.00/M)</option>
                  </select>
                  <p className="text-[10px] text-text-secondary italic">Used for: prompt tightening (delta), bootstrap knowledge.</p>
                </div>
              </div>
              {/* Coder model cheat sheet */}
              <div className="bg-surface-alt/40 border border-surface-alt rounded-lg p-3">
                <p className="text-[11px] font-bold text-text-primary mb-2">Which model to paste into for manual prompts:</p>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-badge-green font-mono whitespace-nowrap">gemini-2.0-flash</span>
                  <span className="text-text-secondary">Single-file fixes, config changes, isolated tasks</span>
                  <span className="text-accent font-mono whitespace-nowrap">gemini-1.5-pro</span>
                  <span className="text-text-secondary">Multi-file features, refactors, anything with side effects</span>
                  <span className="text-purple-400 font-mono whitespace-nowrap">claude-3.5-sonnet</span>
                  <span className="text-text-secondary">Complex TS/React, tricky bugs, best overall reasoning</span>
                  <span className="text-badge-yellow font-mono whitespace-nowrap">gpt-5.4</span>
                  <span className="text-text-secondary">Heavy reasoning, architecture decisions, cross-file analysis</span>
                </div>
              </div>
            </div>
          </section>

          {/* Gemini API — disabled by default */}
          <section className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-surface-alt pb-2">
              <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest">
                Gemini API
                {!geminiEnabled && <span className="ml-2 text-text-secondary/50 font-normal normal-case tracking-normal text-xs">(disabled)</span>}
              </h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-text-secondary">Enable</span>
                <div
                  onClick={() => setGeminiEnabled(!geminiEnabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${geminiEnabled ? 'bg-accent' : 'bg-surface-alt'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${geminiEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>

            <div className={`flex flex-col gap-4 ${!geminiEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase">API Key</label>
                <div className="flex gap-2">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={e => setGeminiApiKey(e.target.value)}
                    className="flex-1 bg-surface-alt text-text-primary p-2.5 rounded border border-surface-alt outline-none focus:border-accent text-sm"
                    placeholder="AIza..."
                    disabled={!geminiEnabled}
                  />
                  <button onClick={() => setShowGeminiKey(!showGeminiKey)} className="px-3 py-2 bg-surface-alt hover:bg-surface border border-surface-alt rounded text-text-primary transition-colors">
                    <EyeIcon visible={showGeminiKey} />
                  </button>
                </div>
                <p className="text-[10px] text-text-secondary italic">Free at <span className="font-mono">aistudio.google.com</span></p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-text-secondary uppercase">Flash Model</label>
                  <select
                    value={geminiFlashModel}
                    onChange={e => setGeminiFlashModel(e.target.value)}
                    disabled={!geminiEnabled}
                    className="bg-surface-alt text-text-primary p-2.5 rounded border border-surface-alt outline-none focus:border-accent text-sm"
                  >
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                    <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-text-secondary uppercase">Pro Model</label>
                  <select
                    value={geminiProModel}
                    onChange={e => setGeminiProModel(e.target.value)}
                    disabled={!geminiEnabled}
                    className="bg-surface-alt text-text-primary p-2.5 rounded border border-surface-alt outline-none focus:border-accent text-sm"
                  >
                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                    <option value="gemini-2.0-pro-exp">gemini-2.0-pro-exp (experimental)</option>
                    <option value="gemini-1.5-pro-002">gemini-1.5-pro-002</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Watch Folders */}
          <section className="flex flex-col gap-6">
            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest border-b border-surface-alt pb-2">Watch Folders</h2>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 bg-surface-alt/30 rounded p-2">
              {watchFolders.length > 0 ? watchFolders.map(p => (
                <div key={p} className="flex items-center justify-between p-2 bg-surface border border-surface-alt rounded group">
                  <span className="text-xs font-mono text-text-secondary truncate pr-4">{p}</span>
                  <button onClick={() => setWatchFolders(watchFolders.filter(x => x !== p))} className="text-badge-red opacity-0 group-hover:opacity-100 transition-opacity p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )) : <p className="text-xs text-text-secondary italic p-4 text-center">No watch folders configured.</p>}
            </div>
            <button onClick={handleAddWatchFolder} className="text-accent text-xs font-bold flex items-center gap-1.5 hover:underline w-fit">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Watch Folder
            </button>
          </section>

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 bg-accent text-white rounded-lg font-bold text-sm shadow-xl shadow-accent/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const PathField: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  onBrowse: () => void; placeholder: string;
}> = ({ label, value, onChange, onBrowse, placeholder }) => (
  <div className="flex flex-col gap-2">
    <label className="text-xs font-bold text-text-secondary uppercase">{label}</label>
    <div className="flex gap-2">
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        className="flex-1 bg-surface-alt text-text-primary p-2.5 rounded border border-surface-alt outline-none focus:border-accent text-sm"
        placeholder={placeholder}
      />
      <button onClick={onBrowse} className="px-4 py-2 bg-surface-alt hover:bg-surface border border-surface-alt rounded text-xs font-bold text-text-primary transition-colors">
        Browse
      </button>
    </div>
  </div>
);

const EyeIcon: React.FC<{ visible: boolean }> = ({ visible }) => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {visible
      ? <>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </>
      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-4.753 4.753m4.753-4.753L3.596 3.596" />
    }
  </svg>
);

export default Settings;
