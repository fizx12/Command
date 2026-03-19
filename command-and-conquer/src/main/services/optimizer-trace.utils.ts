import path from 'path';

const STATIC_HEADERS = [
  'GLOBAL RULES',
  'MASTER PROMPT',
  'COMMAND & CONQUER',
  'APP PRIMER',
  'PROJECT PRIMER',
  'SOURCE OF TRUTH',
  'REPO CONTEXT',
  'OUTPUT FORMAT',
  'OUTPUT LOCATION',
  'AGENT ROLE',
  'AGENT DEFINITION',
  'STEP:',
];

export function extractTaskSectionsFromCompiledPrompt(promptText: string): string {
  const parts = promptText.split(/\n\n---\n\n/);
  const taskParts: string[] = [];

  for (const part of parts) {
    const headerMatch = part.match(/^#+ (.+)/m);
    const header = headerMatch ? headerMatch[1].trim().toUpperCase() : '';
    if (STATIC_HEADERS.some(s => header.includes(s))) break;
    taskParts.push(part);
  }

  if (taskParts.length > 0) {
    return taskParts.join('\n\n---\n\n').trim();
  }

  return parts.filter(part => {
    const headerMatch = part.match(/^#+ (.+)/m);
    const header = headerMatch ? headerMatch[1].trim().toUpperCase() : '';
    return !STATIC_HEADERS.some(s => header.includes(s));
  }).join('\n\n---\n\n').trim();
}

export function extractRunFolderFromCompiledPrompt(promptText: string): string | null {
  const match = promptText.match(
    /# OUTPUT LOCATION[\s\S]*?(?:```|~~~)\s*([\s\S]*?)\s*(?:```|~~~)/i
  );

  if (!match) return null;

  const candidate = match[1]
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean);

  if (!candidate) return null;

  const normalized = candidate.replace(/\\/g, path.sep).trim();
  if (!normalized) return null;

  return path.isAbsolute(normalized) ? normalized : null;
}

