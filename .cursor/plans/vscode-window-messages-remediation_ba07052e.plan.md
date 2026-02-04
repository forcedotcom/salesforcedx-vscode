---
name: vscode-window-messages-remediation
overview: 'Remediate vscode.window.show*Message usage across services, metadata, and org-browser extensions to align with SKILL.md guidelines: use nls.localize for all messages/buttons, use Effect.sync for fire-and-forget, and add void for unhandled promises.'
todos:
  - id: services-retrieveOnLoad
    content: 'Fix retrieveOnLoad.ts: Replace string literal with nls.localize for error message'
    status: pending
  - id: metadata-generateManifest-buttons
    content: 'Fix generateManifest.ts: Replace button label literals with nls.localize'
    status: pending
  - id: metadata-generateManifest-effect
    content: 'Fix generateManifest.ts: Change Effect.promise to Effect.sync for fire-and-forget'
    status: pending
  - id: metadata-createApexClass-buttons
    content: 'Fix createApexClass.ts: Replace button label literals with nls.localize'
    status: pending
  - id: metadata-deleteSourcePath-then
    content: 'Fix deleteSourcePath.ts: Refactor .then() pattern to Effect pattern'
    status: pending
  - id: metadata-deleteSourcePath-effect
    content: 'Fix deleteSourcePath.ts: Change Effect.promise to Effect.sync for fire-and-forget (3 instances)'
    status: pending
  - id: metadata-deployComponentSet-effect
    content: 'Fix deployComponentSet.ts: Change Effect.fork(Effect.promise) to Effect.sync for fire-and-forget'
    status: pending
  - id: metadata-deployOnSave-void
    content: 'Fix deployOnSaveService.ts: Add void for fire-and-forget messages (2 instances)'
    status: pending
  - id: metadata-diffComponentSet-effect
    content: 'Fix diffComponentSet.ts: Change Effect.promise to Effect.sync for fire-and-forget (4 instances)'
    status: pending
  - id: metadata-retrieveComponentSet-effect
    content: 'Fix retrieveComponentSet.ts: Change Effect.promise to Effect.sync for fire-and-forget'
    status: pending
  - id: metadata-deleteComponentSet-effect
    content: 'Fix deleteComponentSet.ts: Change Effect.promise to Effect.sync for fire-and-forget'
    status: pending
  - id: org-browser-index-effect
    content: 'Fix org-browser index.ts: Change Effect.promise to Effect.sync for fire-and-forget'
    status: pending
  - id: org-browser-retrieveMetadata-buttons
    content: 'Fix org-browser retrieveMetadata.ts: Replace button label literals with nls.localize'
    status: pending
isProject: false
---

# VSCode Window Messages Remediation Punch List

## Services Extension (`packages/salesforcedx-vscode-services`)

### 1. `src/core/retrieveOnLoad.ts` (line 121)

- **Issue**: String literal in error message instead of `nls.localize`
- **Fix**: Replace `errorMessage` template literal with `nls.localize('retrieve_on_load_failed', String(error))`
- **Note**: Add new i18n key if needed

## Metadata Extension (`packages/salesforcedx-vscode-metadata`)

### 2. `src/commands/generateManifest.ts` (lines 31-36)

- **Issue**: Button labels `'Overwrite'` and `'Cancel'` are string literals
- **Fix**: Replace with `nls.localize('overwrite_button')` and `nls.localize('cancel_button')`
- **Note**: Add i18n keys if missing

### 3. `src/commands/generateManifest.ts` (line 92)

- **Issue**: Using `Effect.promise()` for fire-and-forget error message
- **Fix**: Change to `Effect.sync(() => void vscode.window.showErrorMessage(...))`

### 4. `src/commands/createApexClass.ts` (line 97)

- **Issue**: Button labels `'Overwrite'` and `'Cancel'` are string literals
- **Fix**: Replace with `nls.localize('overwrite_button')` and `nls.localize('cancel_button')`

### 5. `src/commands/deleteSourcePath.ts` (line 23)

- **Issue**: Using `.then()` instead of `await` in Effect context
- **Fix**: Refactor to use `Effect.promise()` properly or convert to Effect.gen

### 6. `src/commands/deleteSourcePath.ts` (lines 75, 86, 94)

- **Issue**: Using `Effect.promise()` for fire-and-forget error messages
- **Fix**: Change to `Effect.sync(() => void vscode.window.showErrorMessage(...))`

### 7. `src/shared/deploy/deployComponentSet.ts` (line 45)

- **Issue**: Using `Effect.fork(Effect.promise(...))` for fire-and-forget
- **Fix**: Change to `Effect.sync(() => void vscode.window.showErrorMessage(...))`

### 8. `src/services/deployOnSaveService.ts` (lines 79, 83)

- **Issue**: Missing `void` for fire-and-forget messages
- **Fix**: Add `void` before `vscode.window.showErrorMessage(...)`

### 9. `src/shared/diff/diffComponentSet.ts` (lines 183, 192, 201, 208)

- **Issue**: Using `Effect.promise()` for fire-and-forget messages
- **Fix**: Change all to `Effect.sync(() => void vscode.window.show*Message(...))`

### 10. `src/shared/retrieve/retrieveComponentSet.ts` (line 42)

- **Issue**: Using `Effect.promise()` for fire-and-forget error message
- **Fix**: Change to `Effect.sync(() => void vscode.window.showErrorMessage(...))`

### 11. `src/shared/delete/deleteComponentSet.ts` (line 74)

- **Issue**: Using `Effect.promise()` for fire-and-forget error message
- **Fix**: Change to `Effect.sync(() => void vscode.window.showErrorMessage(...))`

## Org-Browser Extension (`packages/salesforcedx-vscode-org-browser`)

### 12. `src/index.ts` (line 62)

- **Issue**: Using `Effect.promise()` for fire-and-forget information message
- **Fix**: Change to `Effect.sync(() => void vscode.window.showInformationMessage(...))`

### 13. `src/commands/retrieveMetadata.ts` (lines 88-92)

- **Issue**: Button labels `'Yes'` and `'No'` are string literals
- **Fix**: Replace with `nls.localize('yes_button')` and `nls.localize('no_button')`
- **Note**: Add i18n keys if missing

## Summary by Category

### String Literals → nls.localize

- retrieveOnLoad.ts (1 instance)
- generateManifest.ts (2 button labels)
- createApexClass.ts (2 button labels)
- retrieveMetadata.ts (2 button labels in org-browser)

### Effect.promise → Effect.sync (fire-and-forget)

- generateManifest.ts (1 instance)
- deleteSourcePath.ts (3 instances)
- deployComponentSet.ts (1 instance)
- diffComponentSet.ts (4 instances)
- retrieveComponentSet.ts (1 instance)
- deleteComponentSet.ts (1 instance)
- index.ts (1 instance in org-browser)

### Missing void (fire-and-forget)

- deployOnSaveService.ts (2 instances)

### Other Issues

- deleteSourcePath.ts (1 instance - .then() pattern)
