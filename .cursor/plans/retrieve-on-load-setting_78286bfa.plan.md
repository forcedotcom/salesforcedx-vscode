---
name: retrieve-on-load-setting
overview: "Add a new setting `retrieveOnLoad` to the Code Builder web section that automatically retrieves specified metadata (format: `MetadataType:FullName`) when the VS Code Services extension loads on web, opens the retrieved files in the editor, then clears the setting after successful retrieval."
todos:
  - id: add-setting-definition
    content: Add retrieveOnLoad setting to package.json configuration
    status: completed
  - id: add-constant
    content: Add RETRIEVE_ON_LOAD_KEY constant to constants.ts
    status: completed
  - id: add-settings-methods
    content: Add getRetrieveOnLoad and clearRetrieveOnLoad methods to SettingsService
    status: completed
    dependencies:
      - add-constant
  - id: create-retrieve-effect
    content: Create retrieveOnLoadEffect that parses setting, retrieves metadata, opens files, and clears setting
    status: completed
    dependencies:
      - add-settings-methods
  - id: integrate-activation
    content: Call retrieveOnLoadEffect in activationEffect for web platform only
    status: completed
    dependencies:
      - create-retrieve-effect
  - id: run-validations
    content: Run compile, lint, test, knip, and bundle checks
    status: completed
---

# Retrieve on Load Setting Implementation

## 1. Add Setting Definition

Add new setting `retrieveOnLoad` in [`packages/salesforcedx-vscode-services/package.json`](packages/salesforcedx-vscode-services/package.json) under the `salesforcedx-vscode-code-builder-web` configuration section (lines 164-178).

```typescript
"salesforcedx-vscode-code-builder-web.retrieveOnLoad": {
  "type": "string",
  "default": "",
  "description": "Comma-separated list of metadata to retrieve on load (format: MetadataType:FullName, e.g. ApexClass:Foo,CustomObject:Account). Web only."
}
```

## 2. Add Constant for Setting Key

Add constant to [`packages/salesforcedx-vscode-services/src/constants.ts`](packages/salesforcedx-vscode-services/src/constants.ts):

```typescript
export const RETRIEVE_ON_LOAD_KEY = 'retrieveOnLoad';
```

## 3. Add SettingsService Methods

Add methods to [`packages/salesforcedx-vscode-services/src/vscode/settingsService.ts`](packages/salesforcedx-vscode-services/src/vscode/settingsService.ts):

- `getRetrieveOnLoad`: Get the setting value
- `clearRetrieveOnLoad`: Clear the setting after successful retrieve

## 4. Create Retrieve on Load Effect

Create new effect in [`packages/salesforcedx-vscode-services/src/index.ts`](packages/salesforcedx-vscode-services/src/index.ts) that:

- Parses the comma-separated setting value into `MetadataMember[]` array (format: `ApexClass:Foo` → `{type: 'ApexClass', fullName: 'Foo'}`)
- Calls `MetadataRetrieveService.retrieve()` with the parsed members (source tracking update is already handled by this service at line 131-133)
- Opens the first retrieved file in the editor using `vscode.workspace.openTextDocument()` and `vscode.window.showTextDocument()` (similar pattern from org-browser at lines 75-93)
- Clears the setting value on success using `SettingsService`
- Shows error notification on failure via `vscode.window.showErrorMessage()`
- Logs activity to output channel via `ChannelService`

## 5. Integrate into Activation Flow

Call the new effect in the `activationEffect` function (line 72) **only when `process.env.ESBUILD_PLATFORM === 'web'`** inside the existing web platform conditional block (line 75-78), using `Effect.forkIn` to run it in the background without blocking activation.

## Implementation Notes

- **Source tracking**: Already handled by `MetadataRetrieveService.retrieve()` (line 131-133 of metadataRetrieveService.ts)
- **Open files**: Use `RetrieveResult.getFileResponses()` to get file paths, then open the first file in editor
- **Web only**: Use existing `process.env.ESBUILD_PLATFORM === 'web'` check
- **Error handling**: Show errors via `vscode.window.showErrorMessage()` per user requirement