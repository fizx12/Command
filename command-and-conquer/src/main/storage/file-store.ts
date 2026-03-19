import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export class FileStore {
  constructor(private basePath: string) {}

  /**
   * Get absolute path from relative
   */
  resolvePath(relativePath: string): string {
    return path.join(this.basePath, relativePath);
  }

  /**
   * Read a JSON file, parse it, return typed result
   */
  async readJSON<T>(relativePath: string): Promise<T> {
    const fullPath = this.resolvePath(relativePath);
    await this.ensureFileExists(fullPath);
    const data = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(data) as T;
  }

  /**
   * Write an object as formatted JSON
   */
  async writeJSON<T>(relativePath: string, data: T): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    await this.ensureDir(path.dirname(relativePath));
    await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Read a markdown file as string
   */
  async readMarkdown(relativePath: string): Promise<string> {
    const fullPath = this.resolvePath(relativePath);
    await this.ensureFileExists(fullPath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  /**
   * Write a string as markdown
   */
  async writeMarkdown(relativePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    await this.ensureDir(path.dirname(relativePath));
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  /**
   * List all items in a directory (returns folder names for entity listings)
   */
  async listDirectories(relativePath: string): Promise<string[]> {
    const fullPath = this.resolvePath(relativePath);
    try {
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      return items.filter(item => item.isDirectory()).map(item => item.name);
    } catch {
      return [];
    }
  }

  /**
   * List all files in a directory matching a glob
   */
  async listFiles(relativePath: string, pattern?: string): Promise<string[]> {
    const fullPath = this.resolvePath(relativePath);
    try {
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      let files = items.filter(item => item.isFile()).map(item => item.name);
      
      if (pattern) {
        // Very basic simple glob implementation for schema (*.schema.json, *.json etc.)
        const matcher = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        files = files.filter(f => matcher.test(f));
      }
      return files;
    } catch {
      return [];
    }
  }

  /**
   * Check if a path exists
   */
  async exists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a directory (recursive)
   */
  async ensureDir(relativePath: string): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    if (!existsSync(fullPath)) {
      await fs.mkdir(fullPath, { recursive: true });
    }
  }

  /**
   * Delete a file or directory
   */
  async remove(relativePath: string): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    if (existsSync(fullPath)) {
      await fs.rm(fullPath, { recursive: true, force: true });
    }
  }

  /**
   * Copy a file
   */
  async copy(from: string, to: string): Promise<void> {
    const fromPath = this.resolvePath(from);
    const toPath = this.resolvePath(to);
    
    await this.ensureFileExists(fromPath);
    await this.ensureDir(path.dirname(to));
    await fs.copyFile(fromPath, toPath);
  }

  private async ensureFileExists(fullPath: string): Promise<void> {
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
  }
}
