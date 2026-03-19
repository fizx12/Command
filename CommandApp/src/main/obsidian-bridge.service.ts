import * as fs from 'fs/promises';
import * as path from 'path';
import { SolvedIssue, DecisionAnchor, ClosureRecord } from '../types';

export class ObsidianBridgeService {
  private vaultBasePath: string;

  constructor(vaultBasePath: string) {
    this.vaultBasePath = vaultBasePath;
  }

  async writeSolvedIssue(projectId: string, issue: SolvedIssue): Promise<void> {
    const dirPath = path.join(this.vaultBasePath, projectId, 'solved');
    await this.ensureDir(dirPath);

    const filePath = path.join(dirPath, `${issue.id}.md`);
    
    const tagsStr = (issue.tags || []).join(', ');
    const filesStr = (issue.filesChanged || []).map((f: string) => `- ${f}`).join('\n');

    const content = `---
title: ${issue.title}
tags: [${tagsStr}]
globalKey: ${issue.globalKey || ''}
created: ${issue.createdAt}
---
# ${issue.title}
## Symptom
${issue.symptom}
## Root Cause
${issue.rootCause}
## Fix
${issue.fixSummary}
## Files Changed
${filesStr}
## Reusable Pattern
${issue.reusablePattern || ''}
`;

    await fs.writeFile(filePath, content, 'utf8');
  }

  async writeDecisionAnchor(projectId: string, anchor: DecisionAnchor): Promise<void> {
    const dirPath = path.join(this.vaultBasePath, projectId, 'decisions');
    await this.ensureDir(dirPath);

    const filePath = path.join(dirPath, `${anchor.id}.md`);
    
    const filesStr = (anchor.filesInPlay || []).map((f: string) => `- ${f}`).join('\n');

    const content = `---
title: ${anchor.status} — ${anchor.summary}
task: ${anchor.taskId}
status: ${anchor.status}
created: ${anchor.createdAt}
---
# ${anchor.status}: ${anchor.summary}
**Task:** ${anchor.taskId}
**Files:**
${filesStr}
`;

    await fs.writeFile(filePath, content, 'utf8');
  }

  async writeClosure(projectId: string, closure: ClosureRecord): Promise<void> {
    const dirPath = path.join(this.vaultBasePath, projectId, 'closures');
    await this.ensureDir(dirPath);

    const filePath = path.join(dirPath, `${closure.id}.md`);
    
    const gapsStr = (closure.remainingGaps || []).map((g: string) => `- ${g}`).join('\n');
    const tasksStr = (closure.followupTaskIds || []).map((t: string) => `- ${t}`).join('\n');

    const content = `---
title: Closure for ${closure.taskId}
task: ${closure.taskId}
size: ${closure.taskSize}
status: ${closure.statusAtClose}
resolution: ${closure.resolution}
created: ${closure.createdAt}
---
# Closure for ${closure.taskId}

## Summary
${closure.solvedSummary}

## Remaining Gaps
${gapsStr || 'None'}

## Follow-up Tasks
${tasksStr || 'None'}
`;

    await fs.writeFile(filePath, content, 'utf8');
  }

  private async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }
}
