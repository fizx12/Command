import * as chokidar from 'chokidar';
import * as path from 'path';
import { EventEmitter } from 'events';

export class WatcherService extends EventEmitter {
  private watchPath: string;
  private watcher: chokidar.FSWatcher | null = null;

  constructor(watchPath: string) {
    super();
    this.watchPath = watchPath;
  }

  start(): void {
    if (this.watcher) return;

    this.watcher = chokidar.watch(this.watchPath, {
      depth: 2,
      ignoreInitial: true
    });

    this.watcher.on('add', (filePath: string) => {
      const basename = path.basename(filePath);
      if (basename === 'job_result.json') {
        const folderPath = path.dirname(filePath);
        this.emit('new-run', { folderPath });
      }
    });
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  isWatching(): boolean {
    return this.watcher !== null;
  }
}
