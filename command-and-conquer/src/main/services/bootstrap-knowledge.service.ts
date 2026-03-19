import * as fs from 'fs/promises';
import * as path from 'path';
import { FileStore } from '../storage/file-store';
import { GeminiService } from './gemini.service';

interface BootstrapResult {
  updated: string[];
  errors: string[];
}

interface FileInfo {
  relativePath: string;
  content: string;
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__']);
const INCLUDE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.json', '.md']);
const SKIP_FILES = new Set(['package-lock.json', 'yarn.lock']);

export class BootstrapKnowledgeService {
  constructor(private fileStore: FileStore, private geminiService: GeminiService) {}

  async bootstrap(
    projectId: string,
    sourcePath: string,
    apiKey: string
  ): Promise<BootstrapResult> {
    try {
      // Recursively read files from sourcePath
      const files = await this.collectFiles(sourcePath);

      if (files.length === 0) {
        return { updated: [], errors: ['No suitable source files found'] };
      }

      // Limit to max 150 files and 200KB total
      const limitedFiles = this.limitFiles(files);

      // Build file tree representation
      const fileTree = this.buildFileTree(limitedFiles);

      // Build bootstrap prompt
      const prompt = this.buildBootstrapPrompt(fileTree);

      // Pro — synthesising architecture docs from a full codebase requires real reasoning
      const response = await this.geminiService.generate(prompt, apiKey, 'pro', 8192);

      // Parse file blocks
      const parsedFiles = GeminiService.parseFileBlocks(response);

      // Write files to knowledge/docs
      const updated: string[] = [];
      for (const [filename, content] of Object.entries(parsedFiles)) {
        try {
          const docPath = `workspace/projects/${projectId}/knowledge/docs/${filename}`;
          await this.fileStore.writeMarkdown(docPath, content);
          updated.push(filename);
        } catch (error) {
          console.error(`Failed to write ${filename}:`, error);
        }
      }

      return { updated, errors: [] };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { updated: [], errors: [errorMsg] };
    }
  }

  private async collectFiles(sourcePath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const stack = [sourcePath];

    while (stack.length > 0) {
      const currentPath = stack.pop()!;

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          if (SKIP_DIRS.has(entry.name)) {
            continue;
          }

          const fullPath = path.join(currentPath, entry.name);

          if (entry.isDirectory()) {
            stack.push(fullPath);
          } else if (entry.isFile()) {
            // Check if we should include this file
            if (this.shouldIncludeFile(entry.name)) {
              try {
                const content = await fs.readFile(fullPath, 'utf-8');
                const relativePath = path.relative(sourcePath, fullPath);
                files.push({
                  relativePath,
                  content,
                });
              } catch {
                // Skip files that can't be read
              }
            }
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    }

    return files;
  }

  private shouldIncludeFile(filename: string): boolean {
    if (SKIP_FILES.has(filename)) {
      return false;
    }

    const ext = path.extname(filename).toLowerCase();
    return INCLUDE_EXTENSIONS.has(ext);
  }

  private limitFiles(files: FileInfo[]): FileInfo[] {
    const MAX_FILES = 150;
    const MAX_TOTAL_SIZE = 200 * 1024; // 200KB
    const MAX_FILE_SIZE = 8 * 1024; // 8KB per file

    let totalSize = 0;
    const limited: FileInfo[] = [];

    for (const file of files) {
      if (limited.length >= MAX_FILES) {
        break;
      }

      let content = file.content;
      if (content.length > MAX_FILE_SIZE) {
        content = content.substring(0, MAX_FILE_SIZE) + '\n... (truncated)';
      }

      const newSize = totalSize + content.length;
      if (newSize > MAX_TOTAL_SIZE) {
        break;
      }

      limited.push({
        ...file,
        content,
      });

      totalSize = newSize;
    }

    return limited;
  }

  private buildFileTree(files: FileInfo[]): string {
    const tree: string[] = [];

    for (const file of files) {
      tree.push(`## ${file.relativePath}\n\`\`\`\n${file.content}\n\`\`\``);
    }

    return tree.join('\n\n');
  }

  private buildBootstrapPrompt(fileTree: string): string {
    return `You are a senior engineer analyzing a codebase for the first time. Your job is to produce three knowledge documents that will be used to onboard future AI coding agents to this project.

## Source Files

${fileTree}

## Your Output

Produce these three files using EXACTLY this format for each:

===FILE: APP_PRIMER.md===
# APP PRIMER — {Project Name}

## What This Is
[What the app does, its purpose, technology stack]

## Core Architecture
[How the system is structured, key modules/services]

## Key Patterns
[Coding patterns, conventions, important APIs used]

## Critical Invariants
[Things that must NEVER break — data contracts, APIs, state assumptions]

## Current State
[What is complete, what is in progress, known issues]
===ENDFILE===

===FILE: SOURCE_OF_TRUTH_INDEX.md===
# SOURCE OF TRUTH INDEX

## Key Files
[List each important file with its role, format: \`path/to/file.ts\` — what it owns/controls]

## Data Flow
[How data moves through the system]

## State Management
[Where state lives, how it's updated]

## Entry Points
[Main entry files, routes, key exports]
===ENDFILE===

===FILE: carry_forward.md===
# CARRY FORWARD — Initial Bootstrap

## Current State
[Overall state of the codebase — what's working, what's rough]

## Watch Out For
[Gotchas, fragile areas, surprising things found in the code]

## Suggested First Tasks
[What would be most valuable to work on next]

## Open Questions
[Anything unclear or undocumented that needs investigation]
===ENDFILE===

Be thorough but accurate. Only describe what you actually see in the code. Do not invent features or patterns.`;
  }
}
