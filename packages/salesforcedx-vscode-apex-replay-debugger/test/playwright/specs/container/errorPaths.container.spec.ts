/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container twin of errorPaths.desktop (ADR 0022). Covers the Apex Replay Debugger error-path
 * COMMAND checks that need NO debug launch, toolbar, or breakpoints in the Code Builder image,
 * running against the container's boot-authed (default target) org:
 *   - "Launch Apex Replay Debugger with Selected File" on a non-Apex file → unsupported-file error
 *   - "Update Checkpoints in Org" with no checkpoints enabled → warning
 *   - "Update Checkpoints in Org" with more than 5 enabled checkpoints → checkpoint-limit error
 * None of these start a replay/interactive debug session. Per-test org setup is removed — every test
 * uses the shared boot org.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  clearOutputChannel,
  closeAllEditors,
  closeWelcomeTabs,
  createApexClass,
  EDITOR_WITH_URI,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  openFileFromExplorerTree,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForNotification,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import metadataNls from 'salesforcedx-vscode-metadata/package.nls.json';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

// Shared, persistent workbench: reset editors and notifications before each test rather than
// assuming a clean slate. No org setup — every test uses the container's boot (default) org.
test.beforeEach(async ({ page }) => {
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

// ── Spec 1: Unsupported file type ─────────────────────────────────────────────

test('Launch Apex Replay Debugger with Selected File (Code Builder): shows error for unsupported file type', async ({
  page
}) => {
  test.setTimeout(120_000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('open an existing non-Apex file from the seeded workspace (README.md)', async () => {
    // No workspaceDir/host fs access in the container: open a non-Apex file that the seeded
    // workspace already ships at its root instead of writing one to disk.
    await openFileFromExplorerTree(page, 'README.md');
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="README.md"]`);
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'setup.unsupported-file-open.png');
  });

  await test.step('run "Launch Apex Replay Debugger with Selected File" — must show unsupported-file error', async () => {
    await executeCommandWithCommandPalette(page, packageNls.launch_apex_replay_debugger_with_selected_file as string);

    const errorNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /You can only run this command with Anonymous Apex files/ })
      .first();
    await expect(errorNotification).toBeVisible({ timeout: 15_000 });
    await saveScreenshot(page, 'step.unsupported-file-error.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

// ── Spec 2: No enabled checkpoints ───────────────────────────────────────────

test('Update Checkpoints in Org (Code Builder): shows warning when no checkpoints are enabled', async ({ page }) => {
  test.setTimeout(120_000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('open the output panel', async () => {
    await ensureOutputPanelOpen(page);
  });

  await test.step('run "Update Checkpoints in Org" with no checkpoints — must show warning notification', async () => {
    await executeCommandWithCommandPalette(page, packageNls.sf_update_checkpoints_in_org as string);
    await waitForNotification(page, /You don't have any checkpoints enabled/, { timeout: 30_000 });
    await saveScreenshot(page, 'step.no-enabled-checkpoints-warning.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

// ── Spec 3: Checkpoint limit exceeded ────────────────────────────────────────

const accountServiceContent = (className: string): string =>
  [
    `public with sharing class ${className} {`,
    '  public Account createAccount(String name) {',
    '    Account acct = new Account(Name = name);',
    '    return acct;',
    '  }',
    '}'
  ].join('\n');

test('Update Checkpoints in Org (Code Builder): shows error when more than 5 checkpoints are enabled', async ({
  page
}) => {
  test.setTimeout(600_000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Six classes, one checkpoint per class → exceeds limit of 5. Names carry a per-run suffix so the
  // shared, persistent workbench never collides with classes left by a prior run.
  const classCount = 6;
  const uid = Date.now().toString(36);
  const classNames = Array.from({ length: classCount }, (_, i) => `AccountService_${uid}_${i + 1}`);

  await test.step('deploy 6 Apex classes to the boot org', async () => {
    for (const className of classNames) {
      await createApexClass(page, className, accountServiceContent(className));
    }

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await executeCommandWithCommandPalette(
      page,
      metadataNls.project_deploy_start_ignore_conflicts_default_org_text as string
    );
    await waitForOutputChannelText(page, { expectedText: 'Starting metadata deployment', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: 120_000 });
    await saveScreenshot(page, 'setup.classes-deployed.png');
  });

  await test.step('toggle one checkpoint in each of the 6 classes', async () => {
    for (const className of classNames) {
      await openFileByName(page, `${className}.cls`);
      const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${className}.cls"]`);
      await editor.waitFor({ state: 'visible', timeout: 15_000 });

      // Click the `return acct;` line then toggle checkpoint
      const returnLine = editor.locator('.view-line').filter({ hasText: 'return acct;' }).first();
      await expect(returnLine).toBeVisible({ timeout: 15_000 });
      await returnLine.click();

      await executeCommandWithCommandPalette(page, packageNls.sf_toggle_checkpoint as string, undefined, {
        preserveSelection: true
      });

      const checkpointGlyph = page.locator('div.codicon-debug-breakpoint-conditional');
      await expect(checkpointGlyph.first()).toBeVisible({ timeout: 15_000 });
    }
    await saveScreenshot(page, 'step.six-checkpoints-toggled.png');
  });

  await test.step('run "Update Checkpoints in Org" — must show checkpoint-limit error', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Replay Debugger');
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.sf_update_checkpoints_in_org as string);

    const errorNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /maximum 5 enabled checkpoints/ })
      .first();
    await expect(errorNotification).toBeVisible({ timeout: 30_000 });
    await saveScreenshot(page, 'step.checkpoint-limit-error.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
