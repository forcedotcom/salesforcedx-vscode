---
name: Deploy On Save Metadata
overview: Add deploy-on-save functionality to vscode-metadata extension, enabled by default on web, with appropriate e2e test considerations.
todos:
  - id: add-config-setting
    content: Add deployOnSave.enabled configuration to package.json
    status: completed
  - id: create-deploy-service
    content: Create deployOnSaveService.ts with Effect-based queue and deploy logic
    status: completed
  - id: register-save-handler
    content: Register onDidSaveTextDocument handler in index.ts activation
    status: completed
  - id: web-default
    content: Enable deploy-on-save by default on web platform at activation
    status: completed
  - id: update-e2e-tests
    content: Update sourceTrackingStatusBar e2e test to disable deploy-on-save
    status: completed
---

# Deploy On Save for vscode-metadata Extension

## Current State in vscode-core

The deploy-on-save feature in vscode-core consists of:

1. **Settings** in [`package.json`](packages/salesforcedx-vscode-core/package.json) (lines 872-886):

   - `push-or-deploy-on-save.enabled` (default: false)
   - `push-or-deploy-on-save.preferDeployOnSave` (default: false)
   - `push-or-deploy-on-save.ignoreConflictsOnPush` (default: false)
   - `push-or-deploy-on-save.showOutputPanel` (default: false)

2. **Implementation** in [`pushOrDeployOnSave.ts`](packages/salesforcedx-vscode-core/src/settings/pushOrDeployOnSave.ts):

   - `DeployQueue` class: batches saves with 500ms delay, executes deploy/push
   - `registerPushOrDeployOnSave()`: registers `onDidSaveTextDocument` listener
   - Filters out dot files, `.soql`, `.apex` files
   - Validates path is in package directory

3. **Settings reader** in [`salesforceCoreSettings.ts`](packages/salesforcedx-vscode-core/src/settings/salesforceCoreSettings.ts)

## Implementation Plan for vscode-metadata

### 1. Add Configuration Settings

Add to [`packages/salesforcedx-vscode-metadata/package.json`](packages/salesforcedx-vscode-metadata/package.json) contributes.configuration:

```json
"configuration": {
  "title": "Salesforce Metadata Configuration",
  "properties": {
    "salesforcedx-vscode-metadata.deployOnSave.enabled": {
      "type": "boolean",
      "default": false,
      "description": "Automatically deploy metadata when files are saved (used when vscode-core is not installed)"
    },
    "salesforcedx-vscode-metadata.deployOnSave.ignoreConflicts": {
      "type": "boolean", 
      "default": true,
      "description": "When deploy on save is enabled, ignore conflicts (used when vscode-core is not installed)"
    }
  }
}
```

**Settings Resolution Order:**

```typescript
const getDeployOnSaveEnabled = (): boolean => {
  // 1. Check vscode-core setting first (if core extension installed)
  const coreSetting = vscode.workspace
    .getConfiguration('salesforcedx-vscode-core')
    .get<boolean>('push-or-deploy-on-save.enabled');
  if (coreSetting !== undefined) return coreSetting;
  
  // 2. Fall back to metadata extension's own setting
  const metadataSetting = vscode.workspace
    .getConfiguration('salesforcedx-vscode-metadata')
    .get<boolean>('deployOnSave.enabled');
  if (metadataSetting !== undefined) return metadataSetting;
  
  // 3. Default: enabled on web, disabled on desktop
  return process.env.ESBUILD_PLATFORM === 'web';
};
```

This allows:

- Users with vscode-core to use their existing settings
- Web-only users to use metadata extension settings
- Web platform to default to enabled without explicit config

### 2. Create Deploy On Save Service

Create [`packages/salesforcedx-vscode-metadata/src/services/deployOnSaveService.ts`](packages/salesforcedx-vscode-metadata/src/services/deployOnSaveService.ts):

```typescript
// Key components:

// 1. Queue for collecting saves
const saveQueue = yield* Queue.sliding<vscode.Uri>(100);

// 2. Stream processor using groupedWithin to batch URIs over 500ms window
yield* Stream.fromQueue(saveQueue).pipe(
  Stream.groupedWithin(100, Duration.millis(500)), // Collect up to 100 URIs, emit after 500ms
  Stream.runForEach(uriChunk => deployQueuedFiles(Chunk.toArray(uriChunk)))
);

// 3. Deploy function using MetadataDeployService
const deployQueuedFiles = (uris: vscode.Uri[]) => Effect.gen(function* () {
  const ignoreConflicts = getIgnoreConflictsSetting();
  const componentSet = yield* deployService.getComponentSetForDeploy({ ignoreConflicts });
  if (componentSet.size > 0) {
    yield* deployService.deploy(componentSet);
  }
});

// 4. File filtering (before enqueue)
const shouldDeploy = (uri: vscode.Uri): boolean =>
  !isDotFile(uri) && !isSoql(uri) && !isAnonApex(uri);
```

`Stream.groupedWithin(n, duration)` batches elements: emits a Chunk when either `n` elements collected OR `duration` elapses (whichever comes first). This collects ALL saved URIs during the window, not just the last one.

### 3. Register on Activation

Update [`packages/salesforcedx-vscode-metadata/src/index.ts`](packages/salesforcedx-vscode-metadata/src/index.ts):

- Register `onDidSaveTextDocument` handler
- Check setting before enqueuing

### 4. Web Default Behavior

The setting default in package.json is `false`, but on web we want it enabled by default.

Use `config.inspect()` to check if user explicitly set the value, then apply platform-specific default:

```typescript
const getDeployOnSaveEnabled = (): boolean => {
  // Check vscode-core setting first
  const coreConfig = vscode.workspace.getConfiguration('salesforcedx-vscode-core');
  const coreInspect = coreConfig.inspect<boolean>('push-or-deploy-on-save.enabled');
  if (coreInspect?.globalValue !== undefined) return coreInspect.globalValue;
  
  // Check metadata extension setting
  const metadataConfig = vscode.workspace.getConfiguration('salesforcedx-vscode-metadata');
  const metadataInspect = metadataConfig.inspect<boolean>('deployOnSave.enabled');
  if (metadataInspect?.globalValue !== undefined) return metadataInspect.globalValue;
  
  // No explicit setting: default to enabled on web, disabled on desktop
  return process.env.ESBUILD_PLATFORM === 'web';
};
```

This approach:

- Respects user's explicit settings from either extension
- Enables deploy-on-save by default on web without changing package.json
- Follows existing pattern in vscode-services

### 5. E2E Test Considerations

The existing e2e tests in [`packages/salesforcedx-vscode-metadata/test/playwright/specs/`](packages/salesforcedx-vscode-metadata/test/playwright/specs/) will be affected:

1. **sourceTrackingStatusBar.headless.spec.ts**: Creates a class, edits it, then manually deploys. With deploy-on-save enabled by default on web:

   - After creating/editing the class, it will auto-deploy
   - The manual deploy step may find no local changes
   - **Fix**: Either disable deploy-on-save in test setup, or adjust test expectations

2. **viewChangesCommands.headless.spec.ts**: Tests view changes commands. Less affected since it doesn't rely on specific local change counts persisting.

**Recommended approach**: Use the Settings UI to disable deploy-on-save.

The existing `upsertSettings` helper in `playwright-vscode-ext` only handles textbox inputs. For boolean settings (rendered as checkboxes), we need to extend it:

```typescript
// In playwright-vscode-ext/src/pages/settings.ts, add:
export const setCheckboxSetting = async (page: Page, settingId: string, checked: boolean): Promise<void> => {
  await openSettingsUI(page);
  const searchMonaco = settingsLocator(page).first();
  await searchMonaco.click();
  await page.keyboard.press('Control+KeyA');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(settingId);
  
  const searchResultId = `searchResultModel_${settingId.replaceAll('.', '_')}`;
  const row = page.locator(`[data-id="${searchResultId}"]`).first();
  await row.waitFor({ state: 'visible', timeout: 30_000 });
  
  const checkbox = row.getByRole('checkbox').first();
  const isChecked = await checkbox.isChecked();
  if (isChecked !== checked) {
    await checkbox.click();
  }
};
```

Then in the test:

```typescript
await setCheckboxSetting(page, 'salesforcedx-vscode-metadata.deployOnSave.enabled', false);
```

## Files to Create/Modify

| File | Action |

|------|--------|

| `packages/salesforcedx-vscode-metadata/package.json` | Add configuration settings |

| `packages/salesforcedx-vscode-metadata/src/services/deployOnSaveService.ts` | Create deploy queue service |

| `packages/salesforcedx-vscode-metadata/src/constants.ts` | Add setting key constants |

| `packages/salesforcedx-vscode-metadata/src/index.ts` | Register save handler |

| `packages/salesforcedx-vscode-metadata/src/messages/i18n.ts` | Add error messages |

| `packages/playwright-vscode-ext/src/pages/settings.ts` | Add `setCheckboxSetting` helper |

| `packages/playwright-vscode-ext/src/index.ts` | Export `setCheckboxSetting` |

| `packages/salesforcedx-vscode-metadata/test/playwright/specs/sourceTrackingStatusBar.headless.spec.ts` | Disable deploy-on-save in test setup |