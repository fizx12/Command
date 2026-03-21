import React, { useState } from 'react';
import { tooltipProps } from '../../utils/tooltips';

interface ArtifactViewerProps {
  artifacts: { name: string; content: string; type: 'json' | 'markdown' }[];
}

const ArtifactViewer: React.FC<ArtifactViewerProps> = ({ artifacts }) => {
  const [activeTab, setActiveTab] = useState(0);

  if (!artifacts || artifacts.length === 0) {
    return (
      <div className="bg-surface-alt rounded-lg p-8 text-center border border-dashed border-surface-alt">
        <span className="text-text-secondary italic">No artifacts available to view</span>
      </div>
    );
  }

  const activeArtifact = artifacts[activeTab];

  const formatJSON = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface border border-surface-alt rounded-lg overflow-hidden">
      <div className="flex bg-surface-alt/30 border-b border-surface-alt overflow-x-auto no-scrollbar">
        {artifacts.map((artifact, index) => (
          <button
            key={artifact.name}
            onClick={() => setActiveTab(index)}
            className={`px-4 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${
              activeTab === index
                ? 'border-accent text-accent bg-accent/5'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-alt/50'
            }`}
            {...tooltipProps(`View ${artifact.name}`)}
          >
            {artifact.name}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-auto bg-surface">
        {activeArtifact.type === 'json' ? (
          <pre className="text-xs font-mono text-text-primary bg-surface-alt/30 p-4 rounded-lg leading-relaxed">
            {formatJSON(activeArtifact.content)}
          </pre>
        ) : (
          <div className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed px-2">
            {activeArtifact.content}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArtifactViewer;
