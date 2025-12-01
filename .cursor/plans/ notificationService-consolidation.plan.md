<!-- 0e9ccaf2-4b19-46a7-906c-b502a0309269 03351bf3-5da6-43de-b632-2f2623c1da13 -->
# NotificationService Consolidation

## Goal

Eliminate vscode-core's duplicate `NotificationService` (~120 lines) by enhancing utils-vscode's version to auto-show channel on failure.

## Step 1: Enhance utils-vscode NotificationService

File: [`packages/salesforcedx-utils-vscode/src/commands/notificationService.ts`](packages/salesforcedx-utils-vscode/src/commands/notificationService.ts)

Changes:

1. Store `channelService` reference from `reportCommandExecutionStatus` as instance property
2. Add `this.channelService?.showChannelOutput()` in `showFailedExecution`
3. Add `this.channelService?.showChannelOutput()` in `showCanceledExecution`  
4. Add `this.channelService?.showChannelOutput()` in `reportExecutionError`

## Step 2: Delete vscode-core NotificationService

Delete: [`packages/salesforcedx-vscode-core/src/notifications/notificationService.ts`](packages/salesforcedx-vscode-core/src/notifications/notificationService.ts)

## Step 3: Update vscode-core consumers (14 files)

Update imports from `../notifications` or `../../notifications` to `@salesforce/salesforcedx-utils-vscode`:

- `sfCommandletExecutor.ts` - also pass `channelService` to notification calls
- `libraryBaseTemplateCommand.ts`
- `overwriteComponentPrompt.ts`, `timestampConflictChecker.ts`, `getUriFromActiveEditor.ts`
- `bootstrapCmd.ts`, `retrieveSourcePath.ts`, `projectGenerate.ts`, `sourceDiff.ts`
- `debuggerStop.ts`, `deleteSource.ts`, `pushOrDeployOnSave.ts`, `directoryDiffer.ts`, `salesforceProjectConfig.ts`

## Step 4: Update SalesforceVSCodeCoreApi export

File: [`packages/salesforcedx-vscode-core/src/index.ts`](packages/salesforcedx-vscode-core/src/index.ts)

Re-export `notificationService` from `@salesforce/salesforcedx-utils-vscode` instead of local.

## Step 5: Remove redundant manual showChannelOutput calls

These become unnecessary since NotificationService now auto-shows on failure:

- `salesforcedx-vscode-lwc/src/commands/commandUtils.ts` - remove from `showError`
- `salesforcedx-vscode-org/src/commands/configSet.ts` - remove after error handling

### To-dos

- [ ] Extract updateSelection to utils-vscode, update apex and lwc consumers
- [ ] Refactor vscode-core NotificationService to extend utils-vscode version
- [ ] Consolidate SfCommandletExecutor between utils-vscode and vscode-core
- [ ] Create factory helper for lightning template commands
- [ ] Extract shared getComponents logic from deploy/retrieve commands
- [ ] Extract getTestFileInfo helper for LWC test actions
- [ ] Create executeWithTiming helper for org commands