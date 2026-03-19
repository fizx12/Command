import { ipcMain, dialog } from 'electron'
import { FileStore } from '../storage/file-store'

const DEFAULT_SETTINGS = {
  obsidianVaultPath: '',
  operationalPath: '',
  watchFolders: [],
  defaultModel: 'gemini-flash',
  theme: 'dark',
}

export function registerSettingsHandlers(fileStore: FileStore): void {
  ipcMain.handle('settings:get', async () => {
    try {
      try {
        const result = await (fileStore as unknown as {
          readJSON: <T>(path: string) => Promise<T>
        }).readJSON<typeof DEFAULT_SETTINGS>('system/settings.json')

        return { error: false, data: result }
      } catch {
        return { error: false, data: DEFAULT_SETTINGS }
      }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('settings:update', async (_event, data) => {
    try {
      let current = DEFAULT_SETTINGS

      try {
        current = await (fileStore as unknown as {
          readJSON: <T>(path: string) => Promise<T>
        }).readJSON<typeof DEFAULT_SETTINGS>('system/settings.json')
      } catch {
        current = DEFAULT_SETTINGS
      }

      const nextSettings = {
        ...current,
        ...data,
      }

      await (fileStore as unknown as {
        writeJSON: (path: string, data: unknown) => Promise<void>
      }).writeJSON('system/settings.json', nextSettings)

      return { error: false, data: nextSettings }
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
