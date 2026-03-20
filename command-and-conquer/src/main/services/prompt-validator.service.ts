import { Task } from '../types';

export interface PromptValidationResult {
  pass: boolean;
  warnings: string[];
  hardFails: string[];
}

/**
 * Validates architect output against the original task spec.
 * Checks:
 * - Task spec is reproduced verbatim (hole 1)
 * - Planner covers all scope/must-preserve/out-of-scope items (hole 2)
 * - Architect directives don't leak into fused executor (hole 5)
 * - Task type doesn't collapse (code → docs, docs → code) (hole 10)
 */
export function validateArchitectOutput(task: Task, architectOutput: string): PromptValidationResult {
  const warnings: string[] = [];
  const hardFails: string[] = [];

  // Check 1: Task spec reproduced
  const taskSpecCheck = checkTaskSpecReproduced(task, architectOutput);
  hardFails.push(...taskSpecCheck.hardFails);
  warnings.push(...taskSpecCheck.warnings);

  // Check 2: Planner coverage
  const coverageCheck = checkPlannerCoverage(task, architectOutput);
  warnings.push(...coverageCheck.warnings);
  hardFails.push(...coverageCheck.hardFails);

  // Check 4: Task type collapse
  const typeCheck = detectTaskTypeCollapse(task, architectOutput);
  hardFails.push(...typeCheck.hardFails);
  warnings.push(...typeCheck.warnings);

  return {
    pass: hardFails.length === 0,
    warnings,
    hardFails,
  };
}

/**
 * Scans a string for architect system directive residue that shouldn't appear in executor prompts.
 * Called on the *fused* compiled text, not architect output.
 */
export function checkNoArchitectResidue(compiledText: string): PromptValidationResult {
  const hardFails: string[] = [];
  const residuePatterns = [
    'SYSTEM DIRECTIVE: CHIEF ARCHITECT',
    'Output ONLY the following sections',
    'Reproduce the # TASK SPECIFICATION',
    'output the planner phases as',
    'CONTEXT MODES',
    'WeakSAUCE — Only the task spec',
  ];

  for (const pattern of residuePatterns) {
    if (compiledText.toLowerCase().includes(pattern.toLowerCase())) {
      hardFails.push(`Architect residue in executor prompt: "${pattern}"`);
    }
  }

  return { pass: hardFails.length === 0, warnings: [], hardFails };
}

// Private validators below

function checkTaskSpecReproduced(task: Task, architectOutput: string): PromptValidationResult {
  const hardFails: string[] = [];
  const warnings: string[] = [];

  // Find # TASK SPECIFICATION block
  const specMarkerIdx = architectOutput.indexOf('# TASK SPECIFICATION');
  if (specMarkerIdx === -1) {
    hardFails.push('No "# TASK SPECIFICATION" marker found in architect output');
    return { pass: false, warnings, hardFails };
  }

  // Extract spec block (up to next # heading or end)
  const specBlock = architectOutput.slice(specMarkerIdx);
  const nextHeadingIdx = specBlock.search(/\n#[^#]/);
  const specText = nextHeadingIdx !== -1 ? specBlock.slice(0, nextHeadingIdx) : specBlock;

  // Check each field presence
  if (!specText.includes(task.title)) {
    hardFails.push(`Task spec missing title: "${task.title}"`);
  }
  if (task.description && !specText.includes(task.description.slice(0, 80))) {
    hardFails.push(`Task spec missing or truncated objective`);
  }
  if (task.scope && !specText.includes(task.scope.slice(0, 80))) {
    hardFails.push(`Task spec missing or truncated scope`);
  }
  if (task.outOfScope && !specText.includes(task.outOfScope.slice(0, 80))) {
    hardFails.push(`Task spec missing or truncated out-of-scope`);
  }

  for (const preserve of task.mustPreserve || []) {
    if (preserve && !specText.includes(preserve)) {
      warnings.push(`Must-preserve item not found in spec reproduction: "${preserve}"`);
    }
  }

  return { pass: hardFails.length === 0, warnings, hardFails };
}

function checkPlannerCoverage(task: Task, architectOutput: string): PromptValidationResult {
  const warnings: string[] = [];
  const hardFails: string[] = [];

  // Find PLANNER OUTPUT section
  const plannerMarkerIdx = architectOutput.indexOf('# PLANNER OUTPUT');
  if (plannerMarkerIdx === -1) {
    warnings.push('No "# PLANNER OUTPUT" section found');
    return { pass: true, warnings, hardFails };
  }

  const plannerBlock = architectOutput.slice(plannerMarkerIdx);

  // Parse scope items (split by newlines, extract meaningful keywords)
  const scopeItems = (task.scope || '')
    .split('\n')
    .filter(s => s.trim().length > 0)
    .map(s => s.replace(/^[\-\*]\s+/, '').trim())
    .filter(s => s.length > 3);

  for (const item of scopeItems) {
    const keyword = item.split(/\s+/)[0];
    if (!plannerBlock.toLowerCase().includes(keyword.toLowerCase())) {
      warnings.push(`Scope item not covered in planner: "${item}"`);
    }
  }

  // Parse out-of-scope items — they should NOT appear with action verbs
  const outOfScopeItems = (task.outOfScope || '')
    .split('\n')
    .filter(s => s.trim().length > 0)
    .map(s => s.replace(/^[\-\*]\s+/, '').trim());

  const actionVerbs = ['create', 'modify', 'update', 'add', 'change', 'refactor', 'delete', 'remove'];
  for (const item of outOfScopeItems) {
    for (const verb of actionVerbs) {
      const pattern = new RegExp(`${verb}.*${item}`, 'i');
      if (pattern.test(plannerBlock)) {
        hardFails.push(`Planner touches out-of-scope item: "${item}" with verb "${verb}"`);
      }
    }
  }

  // Parse must-preserve items — they should appear in an acknowledgement or protection section
  for (const preserve of task.mustPreserve || []) {
    if (!preserve) continue;
    const keyword = preserve.split(/\s+/)[0];
    if (!plannerBlock.toLowerCase().includes(keyword.toLowerCase())) {
      warnings.push(`Must-preserve item may not be actively protected in plan: "${preserve}"`);
    }
  }

  return { pass: hardFails.length === 0, warnings, hardFails };
}

function detectTaskTypeCollapse(task: Task, architectOutput: string): PromptValidationResult {
  const warnings: string[] = [];
  const hardFails: string[] = [];

  // Classify original task
  const codeExtensions = /\.(ts|tsx|js|jsx|py|java|go|rs|c|cpp|h|css|scss|html|vue|svelte)\b/i;
  const hasCodeInScope = codeExtensions.test(task.scope);
  const docKeywords = /\b(document|readme|doc|knowledge|wiki|guide|md|markdown)\b/i;
  const hasDocInTitle = docKeywords.test(task.title) || docKeywords.test(task.description);

  let originalType = 'mixed';
  if (hasCodeInScope) originalType = 'code';
  else if (hasDocInTitle) originalType = 'docs';

  // Classify architect planner output
  const plannerMarkerIdx = architectOutput.indexOf('# PLANNER OUTPUT');
  if (plannerMarkerIdx === -1) {
    return { pass: true, warnings, hardFails }; // No planner yet, skip check
  }

  const plannerBlock = architectOutput.slice(plannerMarkerIdx);
  const codeFileMatches = plannerBlock.match(/`?[\w\-./]+\.(ts|tsx|js|jsx|py|java|go|rs|c|cpp|h|css|scss|html|vue|svelte)`?/gi) || [];
  const docFileMatches = plannerBlock.match(/`?[\w\-./]+\.md`?/gi) || [];

  let architectType = 'mixed';
  if (codeFileMatches.length > 0 && docFileMatches.length === 0) architectType = 'code';
  else if (docFileMatches.length > 0 && codeFileMatches.length === 0) architectType = 'docs';

  // Detect collapse
  if (originalType === 'code' && architectType === 'docs') {
    hardFails.push('Task type collapse: task requires code changes but planner produced documentation-only plan');
  } else if (originalType === 'docs' && architectType === 'code') {
    warnings.push('Task type escalation: task is documentation but planner includes code changes');
  }

  return { pass: hardFails.length === 0, warnings, hardFails };
}
