# STEP 1C — PASTE THIS INTO YOUR SMARTEST AVAILABLE AI (review checkpoint)

## Run this AFTER Step 1A and 1B are both done. Paste the outputs from both steps below this prompt.

You are reviewing the foundation code for an Electron + React app called Command and Conquer. Two different AIs produced this code in parallel. Your job is to find and fix any inconsistencies between them before 50 more files get built on top of this foundation.

## CHECK THESE THINGS

### 1. Type imports will work
- Do the IPC channel names in `preload.ts` / `api.ts` match what the types expect?
- Do the `Create*Input` and `Update*Input` types have all fields the preload API methods would need?
- Does `file-store.ts` return types that match what services will need?

### 2. Paths are consistent
- Does `tsconfig.json` path aliases match how files import each other?
- Does `vite.config.ts` resolve aliases match the renderer imports?
- Does `electron-builder.json` reference the correct output directories?

### 3. No missing pieces
- Is there an `index.html` for the renderer?
- Is there a `main.tsx` entry for React?
- Does `App.tsx` import from `react-router-dom` correctly for Electron (HashRouter)?
- Are all Tailwind config paths correct?

### 4. No conflicts between the two outputs
- Do any type names clash?
- Do any files overlap?
- Are naming conventions consistent (camelCase for TS, kebab-case for files)?

### 5. Security
- Is `nodeIntegration: false` in the BrowserWindow config?
- Is `contextIsolation: true`?
- Does preload use `contextBridge.exposeInMainWorld` correctly?
- No `remote` module usage?

## OUTPUT FORMAT

List every issue found as:

```
ISSUE: {description}
FILE: {which file}
FIX: {exact fix needed}
```

If no issues: say "FOUNDATION APPROVED — ready for Step 2."

---

## STEP 1A OUTPUT (Sonnet scaffold):

{PASTE STEP 1A OUTPUT HERE}

## STEP 1B OUTPUT (ChatGPT types):

{PASTE STEP 1B OUTPUT HERE}
