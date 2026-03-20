import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { FileStore } from './storage/file-store';
import { SchemaValidator } from './storage/schema-validator';
import { ProjectService } from './services/project.service';
import { TaskService } from './services/task.service';
import { RunImporterService } from './services/run-importer.service';
import { KnowledgeService } from './services/knowledge.service';
import { PromptCompilerService } from './services/prompt-compiler.service';
import { RunWatcherService } from './services/run-watcher.service';
import { GeminiService } from './services/gemini.service';
import { BootstrapKnowledgeService } from './services/bootstrap-knowledge.service';
import { PromptRefinerService } from './services/prompt-refiner.service';
import { PromptFuserService } from './services/prompt-fuser.service';
import { RepoContextService } from './services/repo-context.service';
import { FullRepoContextService } from './services/full-repo-context.service';
import { RunEvaluatorService } from './services/run-evaluator.service';
import { registerAllHandlers } from './ipc';
import { initLanHub, stopLanHub } from './services/lanHub';

// Determine base path for the workspace
const basePath = 'c:/Users/G/Documents/Command/command-and-conquer';
console.log('[Main] Base Path:', basePath);

const fileStore = new FileStore(basePath);
const schemaValidator = new SchemaValidator(path.join(basePath, 'src/main/schemas'));

const projectService = new ProjectService(fileStore);
const taskService = new TaskService(fileStore);
const knowledgeService = new KnowledgeService(fileStore, projectService);
const runImporterService = new RunImporterService(fileStore, schemaValidator, knowledgeService, taskService);
const promptCompilerService = new PromptCompilerService(fileStore, taskService);
const runWatcherService = new RunWatcherService(fileStore, runImporterService, taskService);
// Load settings at startup so GeminiService knows which models to use
let initialSettings: Record<string, unknown> = {};
const localSettingsPath = path.join(basePath, 'system/settings.json');
const externalSettingsPath = 'C:/Users/G/command-secrets/settings.json';

try {
  if (fs.existsSync(localSettingsPath)) {
    initialSettings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
  }
  // Merge external settings if they exist (secrets)
  if (fs.existsSync(externalSettingsPath)) {
    const externalSettings = JSON.parse(fs.readFileSync(externalSettingsPath, 'utf8'));
    initialSettings = { ...initialSettings, ...externalSettings };
  }
} catch { /* settings not yet created — defaults apply */ }
const geminiService = new GeminiService(initialSettings as any);
const bootstrapKnowledgeService = new BootstrapKnowledgeService(fileStore, geminiService);
const promptRefinerService = new PromptRefinerService(geminiService);
const promptFuserService = new PromptFuserService(geminiService);
const repoContextService = new RepoContextService(geminiService, fileStore);
const fullRepoContextService = new FullRepoContextService(projectService, fileStore);
const runEvaluatorService = new RunEvaluatorService(geminiService);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#1e1e2e', // dark background matching surface color
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5178');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  // Once the renderer is ready, scan for any runs written while the app was closed
  mainWindow.webContents.once('did-finish-load', () => {
    runWatcherService.scanOnStartup().catch(() => { /* non-fatal */ });
  });

  // Set up CSP headers
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-eval' 'unsafe-inline' localhost:* ws://localhost:*"],
      },
    });
  });

  return mainWindow;
}

app.whenReady().then(async () => {
  // Register IPC handlers FIRST — they must be ready before the renderer loads
  registerAllHandlers({
    projectService,
    taskService,
    runImporterService,
    knowledgeService,
    promptCompilerService,
    fileStore,
    geminiService,
    bootstrapKnowledgeService,
    promptRefinerService,
    promptFuserService,
    repoContextService,
    fullRepoContextService,
    runEvaluatorService
  });

  // Start the file watcher BEFORE the window loads so its path map is ready
  // when did-finish-load fires scanOnStartup()
  await runWatcherService.start().catch((err) => {
    console.error('[Main] Watcher start failed:', err);
  });

  // Initialize LAN Hub integration
  initLanHub();

  // Create the window AFTER the watcher is ready — did-finish-load triggers scanOnStartup
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  runWatcherService.stop();
  stopLanHub();
});
