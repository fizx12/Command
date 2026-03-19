import { ipcMain, dialog } from 'electron'
import { FileStore } from '../storage/file-store'
import fs from 'fs'
import path from 'path'

const EXTERNAL_SETTINGS_PATH = 'C:/Users/G/command-secrets/settings.json'

function getExternalSettings(): any {
  try {
    if (fs.existsSync(EXTERNAL_SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(EXTERNAL_SETTINGS_PATH, 'utf8'))
    }
  } catch (err) {
    console.error('[Settings] Failed to read external settings:', err)
  }
  return {}
}

function saveExternalSettings(data: any) {
  try {
    const dir = path.dirname(EXTERNAL_SETTINGS_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    // Only save specific keys to external file
    const secrets = {
      openaiApiKey: data.openaiApiKey || '',
      geminiApiKey: data.geminiApiKey || ''
    }
    fs.writeFileSync(EXTERNAL_SETTINGS_PATH, JSON.stringify(secrets, null, 2), 'utf8')
  } catch (err) {
    console.error('[Settings] Failed to save external settings:', err)
  }
}

const DEFAULT_SETTINGS = {
  obsidianVaultPath: '',
  hubPath: '',          // Single hub folder where ALL runs from ALL projects are written
                        // e.g. C:\Users\G\Documents\Command\.c2
                        // Runs land at: {hubPath}/runs/{projectId}/{runId}/
  watchFolders: [],
  defaultModel: 'gpt-4o-mini',
  theme: 'dark',
  // OpenAI (primary — prompt tightening, bootstrap, evaluation)
  openaiApiKey: '',
  flashModel: 'gpt-4o-mini',   // cheap/fast: evaluation, ping
  proModel: 'gpt-5.4',          // smart: tighten, bootstrap
  // Gemini (disabled by default — kept for future use)
  geminiEnabled: false,
  geminiApiKey: '',
  geminiFlashModel: 'gemini-2.0-flash',
  geminiProModel: 'gemini-1.5-pro',
}

export function registerSettingsHandlers(fileStore: FileStore): void {
  ipcMain.handle('settings:get', async () => {
    try {
      let stored = {}
      try {
        stored = await fileStore.readJSON<typeof DEFAULT_SETTINGS>('system/settings.json')
      } catch { /* ignore */ }

      const external = getExternalSettings()
      
      // Merge so new fields are always present even in old settings files
      return { error: false, data: { ...DEFAULT_SETTINGS, ...stored, ...external } }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('settings:update', async (_event, data) => {
    try {
      let current = {}
      try {
        current = await fileStore.readJSON<typeof DEFAULT_SETTINGS>('system/settings.json')
      } catch { /* ignore */ }

      const external = getExternalSettings()
      // @ts-ignore
      const combined = { ...DEFAULT_SETTINGS, ...current, ...external, ...data }

      // Separate secrets from local settings
      const { openaiApiKey, geminiApiKey, ...localSettings } = combined
      
      // Save local settings (excluding secrets)
      await fileStore.writeJSON('system/settings.json', localSettings)
      
      // Save secrets externally
      saveExternalSettings({ openaiApiKey, geminiApiKey })

      return { error: false, data: combined }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('settings:selectFolder', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
      })

      const selectedPath = result.canceled ? null : (result.filePaths[0] ?? null)

      return { error: false, data: selectedPath }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })
}
