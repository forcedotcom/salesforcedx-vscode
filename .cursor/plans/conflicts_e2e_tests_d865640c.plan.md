---
name: ''
overview: ''
todos: []
isProject: false
---

# E2E Tests for Conflict Detection

## Context

Branch `sm/conflicts-view-in-metadata` implements conflict detection for both source-tracking and non-source-tracking orgs. The implementation has two distinct code paths:

1. **Source tracking orgs** (`detectConflictsFromTracking`): Uses `SourceTrackingService.getConflicts()` to read `.sf/orgs/{orgId}/` tracking files
2. **Non-source-tracking orgs** (`detectConflictsFromTimestamps`): Compares timestamps in `.sfdx/fileResponses/{orgId}/` against remote `lastModifiedDate`

Both paths support retrieve and deploy operations with different conflict logic:

- **Retrieve**: Detects if local file differs from remote (would be overwritten)
- **Deploy**: Detects if remote changed since last deploy/retrieve (for non-tracking), or has conflicts (for tracking)

**Problem**: No E2E tests exist to validate these conflict detection mechanisms work correctly in real VS Code environments. Tests need to:

- Create actual conflicts programmatically via CLI
- Validate status bar shows conflicts with error background
- Test modal interactions (View Conflicts, Override buttons)
- Verify conflicts tree view and diff editor work
- Run sequentially with exclusive org access (parallel tests would corrupt tracking state)

**Scope**: This plan covers **desktop tests only**. Web tests are a separate follow-up effort after desktop tests are proven.

---

## Implementation Plan

### 1. Add Polling Interval Setting

**Why**: Status bar polls remote changes every 60 seconds (hardcoded). Tests need faster polling (3s) to avoid long waits.

**Files to modify**:

- `packages/salesforcedx-vscode-metadata/package.json`
- `packages/salesforcedx-vscode-metadata/src/statusBar/sourceTrackingStatusBar.ts`

**Changes**:

1. Add setting to `package.json` contributes section (follow pattern from `packages/salesforcedx-vscode-apex-log/package.json`):

```json
"salesforcedx-vscode-metadata.sourceTracking.pollingIntervalSeconds": {
  "type": "number",
  "default": 60,
  "minimum": 0,
  "description": "Interval in seconds to poll for remote source tracking changes. Set to 0 to disable polling."
}
```

1. In `sourceTrackingStatusBar.ts`, implement dynamic polling interval using the Effect pattern from `packages/salesforcedx-vscode-apex-log/src/logs/logAutoCollect.ts:104-147`.

**Pattern follows Effect best practices:**

- Uses `SubscriptionRef` for reactive state (polling interval)
- `SettingsWatcherService` watches config changes via PubSub
- `Stream.flatMap` with `switch: true` restarts schedule when interval changes
- Yields services from context (not passed as params)

**Implementation:**

```typescript
// Helper to read config (outside Effect.gen)
const getPollingIntervalSeconds = (): number =>
  vscode.workspace
    .getConfiguration('salesforcedx-vscode-metadata')
    .get<number>('sourceTracking.pollingIntervalSeconds', 60);

// Inside createSourceTrackingStatusBar (after line 95):
const settingsWatcher = yield * api.services.SettingsWatcherService;
const pollIntervalRef = yield * SubscriptionRef.make(Duration.seconds(getPollingIntervalSeconds()));

// Watch setting changes to update poll frequency dynamically
yield *
  Effect.fork(
    Stream.fromPubSub(settingsWatcher.pubsub).pipe(
      Stream.filter(event =>
        event.affectsConfiguration('salesforcedx-vscode-metadata.sourceTracking.pollingIntervalSeconds')
      ),
      Stream.runForEach(() => SubscriptionRef.set(pollIntervalRef, Duration.seconds(getPollingIntervalSeconds())))
    )
  );

// Dynamic poll stream that restarts when interval changes
const dynamicPollStream = Stream.concat(
  Stream.make(yield * SubscriptionRef.get(pollIntervalRef)),
  pollIntervalRef.changes
).pipe(
  Stream.filter(d => Duration.greaterThan(d, Duration.zero)), // 0 means don't poll
  Stream.flatMap(
    interval => Stream.fromSchedule(Schedule.fixed(interval)).pipe(Stream.filter(() => vscode.window.state.active)),
    { switch: true } // Restart schedule when interval changes - replaces old stream
  )
);

// Replace line 100 hardcoded Schedule.fixed(Duration.minutes(1)) with dynamicPollStream
// In the fileChangeStream merge:
const fileChangeStream = Stream.merge(
  Stream.fromQueue(dequeue).pipe(Stream.debounce(Duration.millis(500))),
  dynamicPollStream // CHANGED: was Schedule.fixed(Duration.minutes(1))
).pipe(
  Stream.debounce(Duration.millis(500)),
  Stream.filterEffect(() =>
    SubscriptionRef.get(targetOrgRef).pipe(Effect.andThen(orgInfo => Boolean(orgInfo.tracksSource)))
  ),
  Stream.as('refresh')
);
```

---

### 2. Create Test Infrastructure

#### 2.1 Helper Project Fixture

**File**: `packages/salesforcedx-vscode-metadata/test/playwright/fixtures/helperProject.ts`

Create utility class for managing the helper project directory that simulates remote changes:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class HelperProject {
  constructor(
    private dir: string,
    private orgAlias: string
  ) {}

  async createApexClass(name: string, content: string): Promise<void> {
    const classDir = path.join(this.dir, 'force-app/main/default/classes');
    await fs.mkdir(classDir, { recursive: true });

    // Write .cls file
    await fs.writeFile(path.join(classDir, `${name}.cls`), content);

    // Write .cls-meta.xml
    const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>62.0</apiVersion>
    <status>Active</status>
</ApexClass>`;
    await fs.writeFile(path.join(classDir, `${name}.cls-meta.xml`), metaXml);
  }

  async deploy(): Promise<void> {
    await execAsync(`sf project deploy start -o ${this.orgAlias} --ignore-conflicts`, {
      cwd: this.dir
    });
  }
}
```

**Fixture extension** in `packages/salesforcedx-vscode-metadata/test/playwright/fixtures/desktopFixtures.ts`:

```typescript
import { createDesktopTest } from '@salesforce/playwright-vscode-ext';
import { HelperProject } from './helperProject';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Base test with org targeting
const desktopTest = createDesktopTest({
  // orgAlias passed per-test (tracking vs non-tracking)
});

// Import existing Page classes
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';

// Tracking org tests
export const trackingConflictTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: MINIMAL_ORG_ALIAS,
  additionalExtensionDirs: ['salesforcedx-vscode-apex-log'],
  userSettings: {
    'salesforcedx-vscode-core.useMetadataExtensionCommands': true,
    'salesforcedx-vscode-metadata.sourceTracking.pollingIntervalSeconds': 3
  }
}).extend<{ helperProject: HelperProject; statusBarPage: SourceTrackingStatusBarPage }>({
  helperProject: async ({ workerId }, use) => {
    const dir = path.join(os.tmpdir(), `conflict-helper-${workerId}`);

    // Create sfdx-project.json
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'sfdx-project.json'),
      JSON.stringify(
        {
          packageDirectories: [{ path: 'force-app', default: true }],
          namespace: '',
          sfdcLoginUrl: 'https://login.salesforce.com',
          sourceApiVersion: '62.0'
        },
        null,
        2
      )
    );

    const helper = new HelperProject(dir, MINIMAL_ORG_ALIAS);
    await use(helper);

    // Cleanup not needed - OS temp cleanup handles it
  },
  statusBarPage: async ({ page }, use) => {
    await use(new SourceTrackingStatusBarPage(page));
  }
});

// Non-tracking org tests
export const nonTrackingConflictTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: NON_TRACKING_ORG_ALIAS,
  additionalExtensionDirs: ['salesforcedx-vscode-apex-log'],
  userSettings: {
    'salesforcedx-vscode-core.useMetadataExtensionCommands': true,
    'salesforcedx-vscode-metadata.sourceTracking.pollingIntervalSeconds': 3
  }
}).extend<{ helperProject: HelperProject; statusBarPage: SourceTrackingStatusBarPage }>({
  helperProject: async ({ workerId }, use) => {
    const dir = path.join(os.tmpdir(), `conflict-helper-${workerId}`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'sfdx-project.json'),
      JSON.stringify(
        {
          packageDirectories: [{ path: 'force-app', default: true }],
          namespace: '',
          sfdcLoginUrl: 'https://login.salesforce.com',
          sourceApiVersion: '62.0'
        },
        null,
        2
      )
    );
    const helper = new HelperProject(dir, NON_TRACKING_ORG_ALIAS);
    await use(helper);
  },
  statusBarPage: async ({ page }, use) => {
    await use(new SourceTrackingStatusBarPage(page));
  }
});
```

#### 2.2 Page Objects

**NOTE**: Page objects 1-3 below are only needed for **Phase 2** (UI interactions). Skip these for Phase 1 implementation.

**Files to create** in `packages/salesforcedx-vscode-metadata/test/playwright/pages/`:

1. `**conflictModalPage.ts` (Phase 2 only): Interact with conflict modal

Based on `src/conflict/conflictUi.ts:46` - uses `vscode.window.showWarningMessage(..., { modal: true }, viewConflictsText, overrideText)`:

```typescript
import { Page, expect } from '@playwright/test';

export class ConflictModalPage {
  constructor(private page: Page) {}

  async waitForModal(timeout = 10_000): Promise<void> {
    // Modal dialog created by vscode.window.showWarningMessage
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout });
  }

  async clickButton(buttonText: string): Promise<void> {
    const dialog = this.page.getByRole('dialog');
    const button = dialog.getByRole('button', { name: new RegExp(buttonText, 'i') });
    await button.click();
  }
}
```

1. `**conflictTreeViewPage.ts**` (Phase 2 only): Interact with conflicts tree view

Based on `src/conflict/conflictView.ts:41` - tree view ID is `'conflicts'`, similar to org browser patterns:

```typescript
import { Page, Locator } from '@playwright/test';

export class ConflictTreeViewPage {
  private readonly sidebar: Locator;

  constructor(private page: Page) {
    // Conflicts view in sidebar
    this.sidebar = page.locator('[id="workbench.view.extension.conflicts"]');
  }

  async getItems(): Promise<string[]> {
    const items = this.sidebar.getByRole('treeitem');
    return items.allTextContents();
  }

  async clickItem(fileName: string): Promise<void> {
    const item = this.sidebar.getByRole('treeitem', { name: new RegExp(fileName, 'i') });
    await item.click();
  }
}
```

1. `**diffEditorPage.ts**` (Phase 2 only): Validate diff editor

Based on `src/conflict/conflictView.ts:52` - uses `vscode.commands.executeCommand('vscode.diff', remoteUri, localUri, title)`:

```typescript
import { Page, expect } from '@playwright/test';
import { TAB } from '@salesforce/playwright-vscode-ext';

export class DiffEditorPage {
  constructor(private page: Page) {}

  async waitForDiffEditor(timeout = 10_000): Promise<void> {
    // Diff editor creates a tab with both file names in title
    const diffTab = this.page.locator(TAB).filter({ hasText: /↔/ }); // Diff symbol
    await expect(diffTab).toBeVisible({ timeout });
  }

  async getTitle(): Promise<string> {
    const diffTab = this.page.locator(TAB).filter({ hasText: /↔/ }).first();
    return diffTab.textContent() || '';
  }

  async close(): Promise<void> {
    const diffTab = this.page.locator(TAB).filter({ hasText: /↔/ }).first();
    const closeButton = diffTab.locator('.codicon-close');
    await closeButton.click();
  }
}
```

**Reuse existing**: `sourceTrackingStatusBarPage.ts` already has:

- `getCounts()` - parse conflict/remote/local counts
- `waitForCounts(expected)` - poll until counts match
- `hasErrorBackground()` - check for error styling

---

### 3. Configure Playwright for Sequential Execution

**File**: `packages/salesforcedx-vscode-metadata/playwright.config.desktop.ts`

Add projects configuration to separate parallel and sequential tests:

```typescript
export default defineConfig({
  ...sharedConfig,
  projects: [
    {
      name: 'parallel',
      testDir: './test/playwright/specs'
      // Default parallel settings
    },
    {
      name: 'conflicts',
      testDir: './test/playwright/specs-conflicts',
      workers: 1,
      fullyParallel: false
      // Sequential execution for exclusive org access
    }
  ]
});
```

**NPM scripts** (add to `package.json`):

```json
"test:desktop": "playwright test --config=playwright.config.desktop.ts",
"test:desktop:conflicts": "playwright test --config=playwright.config.desktop.ts --project=conflicts"
```

Note: `test:desktop` runs both projects by default.

---

### 4. Create Test Specs

**Directory structure**:

```
packages/salesforcedx-vscode-metadata/test/playwright/
├── specs/                    # Existing parallel tests
└── specs-conflicts/          # NEW: Sequential conflict tests
    ├── tracking/
    │   ├── retrieve-conflict.spec.ts
    │   └── deploy-conflict.spec.ts
    └── non-tracking/
        ├── retrieve-conflict.spec.ts
        └── deploy-conflict.spec.ts
```

#### 4.1 Test Flow Pattern (Two-Phase Implementation)

**IMPORTANT**: Implement tests in two phases to validate incrementally:

**Phase 1: Conflict Detection (Steps 1-5)**

1. **Setup**: Create ApexClass locally, deploy to org (baseline)
2. **Create conflict**: Helper project creates same class with different content, deploys with `--ignore-conflicts`
3. **Local modification**: Modify class locally (creates conflict state)
4. **Wait for detection**: Status bar polling detects conflict (3s max wait with new setting)
5. **Validate status bar**: Conflict count > 0, error background visible

**Goal**: Verify conflict detection mechanism works end-to-end before building UI interaction tests.

**Phase 2: UI Interactions (Steps 6-9)** - Only after Phase 1 working 6. **Attempt operation**: Run retrieve/deploy command → modal appears 7. **Test "View Conflicts"**: Click button → tree view opens → click item → diff editor opens 8. **Test "Override"**: Attempt operation again, click Override → completes successfully 9. **Validate cleared**: Status bar shows conflicts: 0, no error background

**Goal**: Validate full user workflow including modal, tree view, diff editor, and override.

#### 4.2 Incremental Naming Strategy

**Why**: Avoid cleanup between tests. Source members table persists in org even if tracking files deleted. Using unique class names per test:

- Avoids interference between tests
- Tests conflict filtering logic (ConflictTest1 conflicts shouldn't block ConflictTest2 operations)

**Naming convention**:

- `specs-conflicts/tracking/retrieve-conflict.spec.ts` → `RetrieveConflictTest1.cls`
- `specs-conflicts/tracking/deploy-conflict.spec.ts` → `DeployConflictTest1.cls`
- `specs-conflicts/non-tracking/retrieve-conflict.spec.ts` → `NonTrackingRetrieveConflict1.cls`
- `specs-conflicts/non-tracking/deploy-conflict.spec.ts` → `NonTrackingDeployConflict1.cls`

#### 4.3 Example Test Implementation

**File**: `specs-conflicts/tracking/retrieve-conflict.spec.ts`

**Phase 1 Implementation** (conflict detection only):

```typescript
import { trackingConflictTest as test } from '../../fixtures/desktopFixtures';
import {
  createApexClass,
  openFileByName,
  editAndSaveOpenFile,
  executeCommandWithCommandPalette
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';

test.describe('Retrieve Conflict Detection (Source Tracking)', () => {
  test('detects conflict in status bar', async ({ page, helperProject, statusBarPage }) => {
    const className = 'RetrieveConflictTest1';

    // 1. Create and deploy baseline
    await createApexClass(page, className, 'public class RetrieveConflictTest1 { /* v1 */ }');
    await executeCommandWithCommandPalette(page, 'SFDX: Deploy This Source to Org');
    // Wait for deploy notification to disappear (deploy complete)
    await page.waitForTimeout(5000); // TODO: Better wait for deploy completion

    // 2. Helper project creates remote conflict
    await helperProject.createApexClass(className, 'public class RetrieveConflictTest1 { /* remote v2 */ }');
    await helperProject.deploy();

    // 3. Modify locally (different from remote)
    await openFileByName(page, `${className}.cls`);
    await editAndSaveOpenFile(page, 'local v2 modification');

    // 4-5. Wait for status bar to detect conflict
    await statusBarPage.waitForCounts({ conflicts: 1 });
    expect(await statusBarPage.hasErrorBackground()).toBe(true);

    // Phase 1 complete - conflict detected successfully
  });
});
```

**Phase 2 Extension** (add after Phase 1 working):

```typescript
test('detects conflict and allows override', async ({
  workspace,
  helperProject,
  statusBarPage,
  conflictModal,
  conflictTreeView,
  diffEditor
}) => {
  // ... Steps 1-5 from Phase 1 ...

  // 6. Attempt retrieve - modal appears
  await workspace.runCommand('project_retrieve_start_default_org_text');
  await conflictModal.waitForModal();
  expect(await conflictModal.getButtons()).toContain('View Conflicts');
  expect(await conflictModal.getButtons()).toContain('Override');

  // 7. Test View Conflicts flow
  await conflictModal.clickButton('View Conflicts');
  const items = await conflictTreeView.getItems();
  expect(items).toContain(`${className}.cls`);

  await conflictTreeView.clickItem(`${className}.cls`);
  await diffEditor.waitForDiffEditor();
  expect(await diffEditor.getTitle()).toContain(className);

  // 8. Test Override flow
  await diffEditor.close();
  await workspace.runCommand('project_retrieve_start_default_org_text');
  await conflictModal.waitForModal();
  await conflictModal.clickButton('Override');
  await workspace.waitForCommandCompletion();

  // 9. Validate conflict cleared
  await statusBarPage.waitForCounts({ conflicts: 0 });
  expect(await statusBarPage.hasErrorBackground()).toBe(false);
});
```

**Similar structure for all 4 test files**:

- `tracking/retrieve-conflict.spec.ts` - imports `trackingConflictTest`, Phase 1 first, then Phase 2
- `tracking/deploy-conflict.spec.ts` - imports `trackingConflictTest`, Phase 1 first, then Phase 2
- `non-tracking/retrieve-conflict.spec.ts` - imports `nonTrackingConflictTest`, Phase 1 first, then Phase 2 (uses `NON_TRACKING_ORG_ALIAS`)
- `non-tracking/deploy-conflict.spec.ts` - imports `nonTrackingConflictTest`, Phase 1 first, then Phase 2 (tests timestamp-based detection)

---

#### 4.4 Setting Disabled: Conflict Passes Through Without Modal

**Purpose**: Verify that when `detectConflictsForDeployAndRetrieve` is `false` (default), a real conflict scenario produces no conflict modal and the operation completes successfully. This is the NOT-path: same org, same conflict state, different setting → different behavior.

**New fixture** in `desktopFixtures.ts`:

```typescript
export const nonTrackingConflictTestDetectionOff = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: NON_TRACKING_ORG_ALIAS,
  additionalExtensionDirs: ['salesforcedx-vscode-apex-log'],
  userSettings: {
    'salesforcedx-vscode-core.useMetadataExtensionCommands': true,
    // detectConflictsForDeployAndRetrieve intentionally omitted (defaults to false)
    ...playwrightDialogSettings
  }
}).extend<{ helperProject: HelperProject }>({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  helperProject: async ({}: any, use: any) => {
    const dir = path.join(os.tmpdir(), `conflict-helper-${Date.now()}-${Math.random()}`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'sfdx-project.json'),
      JSON.stringify(
        {
          packageDirectories: [{ path: 'force-app', default: true }],
          namespace: '',
          sfdcLoginUrl: 'https://login.salesforce.com',
          sourceApiVersion: '62.0'
        },
        null,
        2
      )
    );
    await use((name: string, content: string) => deployApexClass(dir, NON_TRACKING_ORG_ALIAS, name, content));
  }
});
```

**New file**: `specs-conflicts/non-tracking/setting-disabled.spec.ts`

```typescript
import { nonTrackingConflictTestDetectionOff as test } from '../../fixtures/desktopFixtures';
import {
  createApexClass,
  deployCurrentSourceToOrg,
  openFileByName,
  editOpenFile,
  executeCommandWithCommandPalette,
  saveScreenshot,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';
import packageNls from '../../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../../constants';

test.describe('Conflict Detection Setting Disabled (Non-Source Tracking)', () => {
  test('deploy completes without conflict modal when detection disabled', async ({ page, helperProject }) => {
    const className = `NTSettingOffDeploy${Date.now().toString(36).slice(-6).toUpperCase()}`;

    await test.step('1. Create and deploy baseline', async () => {
      await createApexClass(page, className, `public class ${className} { /* v1 */ }`);
      await deployCurrentSourceToOrg(page);
      await saveScreenshot(page, 'setting-disabled-deploy-1-baseline.png');
    });

    await test.step('2. Helper project creates remote conflict', async () => {
      await helperProject(className, `public class ${className} { /* remote v2 */ }`);
    });

    await test.step('3. Modify locally', async () => {
      await openFileByName(page, `${className}.cls`);
      await editOpenFile(page, 'local v2 modification');
      await saveScreenshot(page, 'setting-disabled-deploy-2-local-modified.png');
    });

    await test.step('4. Deploy succeeds - no conflict modal', async () => {
      await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);

      await waitForOutputChannelText(page, { expectedText: 'deployed', timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'setting-disabled-deploy-3-completed.png');

      const conflictModal = page.getByRole('dialog').filter({ hasText: /conflict/i });
      await expect(conflictModal, 'No conflict modal should appear when setting is disabled').not.toBeVisible();
    });
  });

  test('retrieve completes without conflict modal when detection disabled', async ({ page, helperProject }) => {
    const className = `NTSettingOffRetrieve${Date.now().toString(36).slice(-6).toUpperCase()}`;

    await test.step('1. Create and deploy baseline', async () => {
      await createApexClass(page, className, `public class ${className} { /* v1 */ }`);
      await deployCurrentSourceToOrg(page);
      await saveScreenshot(page, 'setting-disabled-retrieve-1-baseline.png');
    });

    await test.step('2. Helper project creates remote conflict', async () => {
      await helperProject(className, `public class ${className} { /* remote v2 */ }`);
    });

    await test.step('3. Modify locally', async () => {
      await openFileByName(page, `${className}.cls`);
      await editOpenFile(page, 'local v2 modification');
      await saveScreenshot(page, 'setting-disabled-retrieve-2-local-modified.png');
    });

    await test.step('4. Retrieve succeeds - no conflict modal', async () => {
      await executeCommandWithCommandPalette(page, packageNls.retrieve_this_source_text);

      await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'setting-disabled-retrieve-3-completed.png');

      const conflictModal = page.getByRole('dialog').filter({ hasText: /conflict/i });
      await expect(conflictModal, 'No conflict modal should appear when setting is disabled').not.toBeVisible();
    });
  });
});
```

**Why `waitForOutputChannelText` before the modal assertion**: The negative modal assertion would pass trivially before the operation completes. Waiting for the operation to finish first ensures the modal had ample opportunity to appear.

---

### 5. GitHub Actions Setup

**File**: `.github/workflows/metadataE2E.yml`

Add two new jobs for conflict tests that run sequentially with exclusive org access.

#### 5.1 Add Conflict Test Job

**Note**: Desktop only for this plan. Web tests are future work.

```yaml
jobs:
  e2e-web:
    # Existing parallel tests (unchanged)

  e2e-desktop:
    # Existing parallel tests (unchanged)

  e2e-conflicts-desktop: # NEW
    runs-on: ${{ matrix.os }}
    timeout-minutes: 60
    strategy:
      matrix:
        os: [macos-latest, windows-latest]
      fail-fast: false
    env:
      MINIMAL_ORG_ALIAS: minimalTestOrg
      NON_TRACKING_ORG_ALIAS: nonTrackingTestOrg
      SFDX_AUTH_URL: ${{ secrets.SFDX_AUTH_URL_E2E }}
      VSCODE_DESKTOP: 1
      # ... similar to e2e-desktop
    steps:
      # Same org creation steps as e2e-conflicts-web
      # ... Generate projects, create orgs ...

      - name: Run Metadata Conflict E2E tests
        if: steps.try-run.outcome == 'failure'
        run: |
          npm run test:desktop:conflicts -w salesforcedx-vscode-metadata -- --reporter=html
```

**Key points**:

1. **Desktop only**: Web tests not included in this plan (future work)
2. **Reuse existing aliases**: `MINIMAL_ORG_ALIAS` and `NON_TRACKING_ORG_ALIAS` (same as parallel test jobs)
3. **No collision**: Job runs in separate runner/VM from `e2e-desktop`, so same aliases work fine
4. **Same org setup pattern**: Generate project, create scratch org (matches existing e2e-desktop pattern)
5. Run only conflict tests: `npm run test:desktop:conflicts`
6. Job runs independently (no `needs:` clause) for faster CI

---

### 6. Critical Files Reference

**Existing files to modify**:

- `packages/salesforcedx-vscode-metadata/package.json` - add setting, npm scripts
- `packages/salesforcedx-vscode-metadata/playwright.config.desktop.ts` - add projects
- `packages/salesforcedx-vscode-metadata/src/statusBar/sourceTrackingStatusBar.ts:100` - use setting
- `.github/workflows/metadataE2E.yml` - add conflict test jobs

**New files to create**:

- `packages/salesforcedx-vscode-metadata/test/playwright/fixtures/helperProject.ts`
- `packages/salesforcedx-vscode-metadata/test/playwright/pages/conflictModalPage.ts`
- `packages/salesforcedx-vscode-metadata/test/playwright/pages/conflictTreeViewPage.ts`
- `packages/salesforcedx-vscode-metadata/test/playwright/pages/diffEditorPage.ts`
- `packages/salesforcedx-vscode-metadata/test/playwright/specs-conflicts/tracking/retrieve-conflict.spec.ts`
- `packages/salesforcedx-vscode-metadata/test/playwright/specs-conflicts/tracking/deploy-conflict.spec.ts`
- `packages/salesforcedx-vscode-metadata/test/playwright/specs-conflicts/non-tracking/retrieve-conflict.spec.ts`
- `packages/salesforcedx-vscode-metadata/test/playwright/specs-conflicts/non-tracking/deploy-conflict.spec.ts`
- `packages/salesforcedx-vscode-metadata/test/playwright/specs-conflicts/non-tracking/setting-disabled.spec.ts`

**Existing files to reuse**:

- `packages/salesforcedx-vscode-metadata/test/playwright/pages/sourceTrackingStatusBarPage.ts`
- `packages/salesforcedx-vscode-metadata/test/playwright/fixtures/desktopFixtures.ts` (extend for `trackingConflictTest`, `nonTrackingConflictTest`, and `nonTrackingConflictTestDetectionOff`)

**Conflict detection implementation** (context, no changes needed):

- `packages/salesforcedx-vscode-metadata/src/conflict/conflictDetection.ts` - tracking-based detection
- `packages/salesforcedx-vscode-metadata/src/conflict/conflictDetectionTimestamp.ts` - timestamp-based detection
- `packages/salesforcedx-vscode-metadata/src/conflict/conflictFlow.ts` - orchestration
- `packages/salesforcedx-vscode-metadata/src/conflict/conflictView.ts` - tree view commands

---

## Implementation Order

### Phase 1: Conflict Detection Infrastructure

1. Add polling interval setting (Section 1)
2. Create helper project fixture (Section 2.1)
3. Configure Playwright for sequential execution (Section 3)
4. Create basic test specs with Phase 1 flow only (Section 4.1 Phase 1)

- Create 4 test files (tracking retrieve/deploy, non-tracking retrieve/deploy)
- Implement steps 1-5: conflict creation and status bar validation
- Skip modal/tree/diff interactions

1. Add GitHub Actions jobs (Section 5)
2. Verify Phase 1 works locally and in CI

**Checkpoint**: Conflicts are created and detected correctly in status bar before proceeding.

### Phase 2: UI Interaction Testing

1. Create page objects for modal, tree view, diff editor (Section 2.2)
2. Extend test specs with Phase 2 flow (Section 4.1 Phase 2)

- Add steps 6-9: modal, tree view, diff, override

1. Verify Phase 2 works locally and in CI

---

## Verification

**CRITICAL DEBUGGING PRINCIPLE**: When tests fail, ALWAYS examine artifacts (screenshots, HTML reports, span files, snapshots) BEFORE reasoning from code. Electron/VS Code behavior cannot be reliably inferred from code alone. See detailed debugging steps in Phase 1 below.

### Phase 1: Conflict Detection (Local)

1. **Setup orgs locally** (reuse existing aliases):

```bash
   # If orgs don't exist:
   sf org create scratch -d -f config/project-scratch-def.json -a minimalTestOrg --wait 30
   sf org create scratch -d -f config/project-scratch-def.json -a nonTrackingTestOrg --wait 30 --no-track-source


```

1. **Optional: Clear span files for fresh traces**:

```bash
   rm -rf ~/.sf/vscode-spans/


```

Span files auto-output to `~/.sf/vscode-spans/` (node-.jsonl for desktop tests) and are useful for debugging Effect traces.

1. **Run Phase 1 conflict tests**:

```bash
   npm run test:desktop:conflicts -w salesforcedx-vscode-metadata


```

Tests run in sequential mode (`workers: 1`) so output will be cleaner than parallel runs.

1. **Verify Phase 1**:

- All 4 conflict test specs pass (tracking retrieve/deploy, non-tracking retrieve/deploy)
- `setting-disabled.spec.ts` passes: both deploy and retrieve complete without conflict modal
- Tests run sequentially (one at a time)
- Status bar shows conflicts correctly (count > 0, error background)
- Helper project deploys with `--ignore-conflicts` work
- Polling interval setting takes effect (3s polling in tests)

1. **Debugging test failures - CRITICAL:**
   **NEVER reason from code alone when tests fail.** Always use these artifacts:
   a. **Screenshots**: Check `playwright-report/` or `test-results/` for screenshots at failure point - Status bar visibility/content - Modal dialogs - Tree view state - Error messages
   b. **HTML Report**: Open `playwright-report/index.html` in browser - Step-by-step timeline - Network requests - Console logs - Screenshots at each step
   c. **Span Files**: Read `~/.sf/vscode-spans/node-*.jsonl` for Effect traces - Parse JSON lines to see Effect execution flow - Check `durationMs` for timing issues - Look for error statuses - Verify services are being called
   d. **Snapshots**: Check DOM snapshots in test-results for actual UI state
   **When debugging:** Read the artifacts FIRST, then form hypotheses. Don't guess based on code.
2. **Optional manual smoke test** (if artifacts unclear):

- Create conflict manually in VS Code using two project directories
- Verify status bar shows conflict count and error background
- Check that polling detects conflict within expected interval

### Phase 2: UI Interactions (Local)

1. **Run Phase 2 conflict tests** (after Phase 1 working):

```bash
   npm run test:desktop:conflicts -w salesforcedx-vscode-metadata


```

1. **Verify Phase 2**:

- Modal appears with "View Conflicts" and "Override" buttons
- Tree view populates with conflict files
- Diff editor opens showing local vs remote
- Override flow completes successfully
- Status bar clears conflicts after override

1. **Debugging Phase 2 failures**: Use same artifact-based approach from Phase 1:

- Screenshots show modal UI, tree view, diff editor
- HTML report shows UI interaction timeline
- Span files show command execution (retrieve/deploy)
- Check for locator failures in screenshots (element not visible/clickable)

### Phase 3: GitHub Actions (CI)

**Optional: Disable other workflows during iteration** to speed up CI feedback:

- Add branch name to `branches-ignore` in other E2E workflows (`.github/workflows/coreE2E.yml`, etc.)
- Add `--grep "conflict"` to metadataE2E.yml test command to run only conflict tests
- Remove these changes before final PR

1. **Push branch** to trigger `metadataE2E.yml` workflow
2. **Verify job**:

- `e2e-conflicts-desktop` passes on macos-latest and windows-latest
- Job creates orgs using `MINIMAL_ORG_ALIAS` and `NON_TRACKING_ORG_ALIAS`
- Tests run sequentially within job (`workers: 1`)
- Artifacts uploaded (playwright-report, test-results)

1. **Check logs** for:

- Org creation success for both tracking and non-tracking orgs
- Helper project deploy commands succeed with `--ignore-conflicts`
- Status bar polling detects conflicts within 3s
- Modal and tree view interactions work (Phase 2)

1. **Debugging CI failures**: Download artifacts from GitHub Actions

- Playwright reports show screenshots/timeline
- Span files in test-results/spans/ show Effect traces
- Compare CI artifacts to local run artifacts
- Check for environment-specific issues (Windows path separators, timing differences)

### Phase 4: Future Work (Out of Scope for This Plan)

After desktop tests proven working:

- Adapt tests for web environment (`playwright.config.web.ts`)
- Verify helper project CLI commands work from web test context (tests run in headless browser but CLI commands execute in Node)
- Add `e2e-conflicts-web` job to GitHub Actions
- Test on ubuntu-latest (web environment)

---

## Summary

This plan implements comprehensive E2E tests for conflict detection across:

- **2 org types**: source tracking and non-source tracking
- **2 operations**: retrieve and deploy
- **Full UI validation**: status bar, modal, tree view, diff editor, override flow
- **NOT-path validation**: `setting-disabled.spec.ts` verifies that with `detectConflictsForDeployAndRetrieve: false`, a real conflict scenario produces no modal and the operation completes successfully

Tests run sequentially with dedicated conflict orgs to ensure stable, reliable validation of the conflict detection mechanisms on the `sm/conflicts-view-in-metadata` branch.
