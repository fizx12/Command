import React from 'react';

interface ArtifactTailBlockProps {
  outputPath: string;                    // e.g. "workspace/projects/proj-1/runs/"
  runId: string;
}

const ArtifactTailBlock: React.FC<ArtifactTailBlockProps> = ({ outputPath, runId }) => {
  const artifacts = [
    'job_result.json',
    'job_summary.md',
    'changed_files.json',
    'review_checklist.json',
    'code_snippets.md'
  ];

  return (
    <div className="bg-accent/10 border border-accent/30 rounded-lg p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
          Artifact Write Instructions &mdash; Required
        </h3>
      </div>

      <div className="flex flex-col gap-2">
        <ol className="flex flex-col gap-1.5 pl-5">
          {artifacts.map((name, i) => (
            <li key={name} className="text-sm text-text-primary">
              <span className="font-mono text-accent mr-2">{i + 1}.</span>
              <span className="font-mono">{name}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="bg-surface-alt/50 p-3 rounded border border-surface-alt font-mono text-xs text-text-secondary break-all">
        <span className="text-accent uppercase font-bold mr-2 text-[10px]">Target path:</span>
        {outputPath}/RUN-{runId}/
      </div>

      <div className="pt-2 border-t border-accent/20 flex items-start gap-2">
        <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-text-secondary leading-tight italic">
          Do not skip artifacts. Small tasks produce small artifacts, not no artifacts.
        </p>
      </div>
    </div>
  );
};

export default ArtifactTailBlock;
