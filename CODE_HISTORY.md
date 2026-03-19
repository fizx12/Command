# Code History: Command

This file contains code snapshots by version for major implementation blocks.

## v1.0.0 Update: External Secret Management

**Logical Summary:**
Implemented a split between "Project Settings" and "Secrets". Project settings like model preference or themes remain in the repository in `system/settings.json`, while sensitive keys are automatically stored in an external file outside the `Command` folder to ensure push protection.

### Main Process Boot Loader
**File:** [index.ts](file:///c:/Users/G/Documents/Command/command-and-conquer/src/main/index.ts)
```typescript
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
} catch { /* ... */ }
```

### IPC External Savings
**File:** [settings.ipc.ts](file:///c:/Users/G/Documents/Command/command-and-conquer/src/main/ipc/settings.ipc.ts)
```typescript
function saveExternalSettings(data: any) {
    const secrets = {
      openaiApiKey: data.openaiApiKey || '',
      geminiApiKey: data.geminiApiKey || ''
    }
    fs.writeFileSync(EXTERNAL_SETTINGS_PATH, JSON.stringify(secrets, null, 2), 'utf8')
}
```
