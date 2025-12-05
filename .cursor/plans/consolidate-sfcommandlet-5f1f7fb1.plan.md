<!-- 5f1f7fb1-6bfb-4875-811d-96220426f643 b46e2d91-1164-4957-8ad7-e9beb671f634 -->
# Consolidate SfCommandlet

## Summary

Delete `vscode-core/src/commands/util/sfCommandlet.ts` and update all 32 import sites to use `SfCommandlet` from `@salesforce/salesforcedx-utils-vscode`.

## Behavior Change

Accepting that `channelService.clear()` will no longer happen before prechecking - it still happens during execution via the executors, which was causing a double-clear anyway.

## Steps

### 1. Delete the duplicate file

- Delete [`packages/salesforcedx-vscode-core/src/commands/util/sfCommandlet.ts`](packages/salesforcedx-vscode-core/src/commands/util/sfCommandlet.ts)

### 2. Update the barrel export

- In [`packages/salesforcedx-vscode-core/src/commands/util/index.ts`](packages/salesforcedx-vscode-core/src/commands/util/index.ts): remove `SfCommandlet` from exports, re-export from utils-vscode if needed for convenience

### 3. Update internal imports (32 files)

Files importing `SfCommandlet` from `./util` need to import from `@salesforce/salesforcedx-utils-vscode` instead. Most already import other things from utils-vscode, so just add `SfCommandlet` to that import.

Key files:

- `aliasList.ts`, `configList.ts`, `debuggerStop.ts`, `deployManifest.ts`, `deploySourcePath.ts`
- `projectDeployStart.ts`, `projectGenerate.ts`, `projectGenerateManifest.ts`, `projectRetrieveStart.ts`
- `refreshSObjects.ts`, `retrieveManifest.ts`, `retrieveSourcePath.ts`, `sourceDiff.ts`
- All template commands in `templates/`
- `baseDeployRetrieve.ts`, `deployExecutor.ts`, `retrieveExecutor.ts`
- `isvdebugging/bootstrapCmd.ts`, `packageInstall.ts`, `renameLightningComponent.ts`
- `source/viewChanges.ts`, `retrieveMetadata/retrieveComponent.ts`
- `diagnostics/diagnostics.ts`, `index.ts`

### 4. Update public API export

- In [`packages/salesforcedx-vscode-core/src/index.ts`](packages/salesforcedx-vscode-core/src/index.ts): ensure `SfCommandlet` is imported from utils-vscode for the `SalesforceVSCodeCoreApi` type

### 5. Verify

- `npm run compile`
- `npm run lint`
- `npm run test`
- `npx knip` - confirm no dead code

### To-dos

- [ ] Delete vscode-core/src/commands/util/sfCommandlet.ts
- [ ] Update util/index.ts to remove local SfCommandlet export
- [ ] Update 32 files to import SfCommandlet from utils-vscode
- [ ] Update vscode-core/src/index.ts import for public API
- [ ] Run compile, lint, test, knip to verify changes