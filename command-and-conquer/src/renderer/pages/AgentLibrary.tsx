import React from 'react';
import Header from '../components/layout/Header';

interface Agent {
  name: string;
  role: string;
  mode: 'MAX' | 'WeakSAUCE';
  purpose: string;
  preferredModel: string;
}

const AGENTS: Agent[] = [
  // MAX Agents
  { name: 'Auditor MAX', role: 'Auditor', mode: 'MAX', purpose: 'Audits knowledge state and finds conflicts between documents.', preferredModel: 'Claude 3.5 Sonnet' },
  { name: 'Planner MAX', role: 'Planner', mode: 'MAX', purpose: 'Deconstructs complex goals into actionable implementation plans.', preferredModel: 'GPT-4o' },
  { name: 'Implementer MAX', role: 'Implementer', mode: 'MAX', purpose: 'Writes production-ready code while preserving invariants.', preferredModel: 'Claude 3.5 Sonnet' },
  { name: 'Reviewer MAX', role: 'Reviewer', mode: 'MAX', purpose: 'Reviews file changes for regressions, logic errors, and style.', preferredModel: 'GPT-4o' },
  { name: 'Compressor MAX', role: 'Compressor', mode: 'MAX', purpose: 'Distills long conversation logs and runs into concise summaries.', preferredModel: 'GPT-4o-mini' },
  { name: 'Truth Maintainer MAX', role: 'Truth Maintainer', mode: 'MAX', purpose: 'Ensures the codebase remains consistent with its primary documentation.', preferredModel: 'Claude 3.5 Sonnet' },
  { name: 'UX Critic MAX', role: 'UX Critic', mode: 'MAX', purpose: 'Evaluates UI/UX changes for accessibility and visual polish.', preferredModel: 'GPT-4o' },
  { name: 'Task Closer MAX', role: 'Task Closer', mode: 'MAX', purpose: 'Handles final resolution, documentation updates, and closure checklists.', preferredModel: 'Claude 3.5 Sonnet' },
  
  // WeakSAUCE Agents
  { name: 'Planner WeakSAUCE', role: 'Planner', mode: 'WeakSAUCE', purpose: 'Quick task planning with minimal context overhead.', preferredModel: 'GPT-4o-mini' },
  { name: 'Implementer WeakSAUCE', role: 'Implementer', mode: 'WeakSAUCE', purpose: 'Rapid sketching and boilerplate generation.', preferredModel: 'GPT-4o-mini' },
  { name: 'Reviewer WeakSAUCE', role: 'Reviewer', mode: 'WeakSAUCE', purpose: 'Light checks for syntax and obvious errors.', preferredModel: 'GPT-4o-mini' },
];

const AgentLibrary: React.FC = () => {
  const maxAgents = AGENTS.filter(a => a.mode === 'MAX');
  const weakSauceAgents = AGENTS.filter(a => a.mode === 'WeakSAUCE');

  const AgentCard = ({ agent }: { agent: Agent }) => (
    <div className="bg-surface-alt rounded-lg p-5 border border-surface-alt hover:border-accent/40 transition-all flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <h3 className="text-text-primary font-bold">{agent.name}</h3>
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{agent.role}</span>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
          agent.mode === 'MAX' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'
        }`}>
          {agent.mode}
        </span>
      </div>
      
      <p className="text-sm text-text-secondary leading-relaxed min-h-[3rem]">
        {agent.purpose}
      </p>

      <div className="pt-3 border-t border-surface/30 flex items-center justify-between">
        <span className="text-[10px] font-bold text-text-secondary uppercase">Preference:</span>
        <span className="text-[11px] font-mono text-accent">{agent.preferredModel}</span>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-surface">
      <Header title="Agents" />

      <main className="flex-1 p-6 overflow-auto bg-surface flex flex-col gap-12">
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-[0.2em]">MAX Capability Tier</h2>
            <div className="flex-1 h-px bg-surface-alt"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {maxAgents.map(agent => (
              <AgentCard key={agent.name} agent={agent} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-[0.2em]">WeakSAUCE Capability Tier</h2>
            <div className="flex-1 h-px bg-surface-alt"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {weakSauceAgents.map(agent => (
              <AgentCard key={agent.name} agent={agent} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default AgentLibrary;
