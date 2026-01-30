---
name: NotificationService Consolidation
overview: ''
todos:
  - id: a84e2fc9-2ae7-4f02-b561-4582bb8d8475
    content: Extract updateSelection to utils-vscode, update apex and lwc consumers
    status: pending
  - id: 37aee1dd-c09c-4ea0-893c-b45792fc57e4
    content: Refactor vscode-core NotificationService to extend utils-vscode version
    status: pending
  - id: f2bee31e-7e51-43b2-9126-69f342e15b73
    content: Consolidate SfCommandletExecutor between utils-vscode and vscode-core
    status: pending
  - id: a1397f27-0b0a-4301-88a9-ee6a8c27055a
    content: Create factory helper for lightning template commands
    status: pending
  - id: 66769bfa-da88-43fb-ab53-a47c09b73104
    content: Extract shared getComponents logic from deploy/retrieve commands
    status: pending
  - id: d15af2dd-4001-49e8-9013-aa20c9d200e8
    content: Extract getTestFileInfo helper for LWC test actions
    status: pending
  - id: 1c896e56-e366-4c55-a3f2-b4bcb8c40af7
    content: Create executeWithTiming helper for org commands
    status: pending
---

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
