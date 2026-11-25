/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from '@playwright/test';
import {
  clearOutputChannel,
  createApexClass,
  EDITOR_WITH_URI,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForNotification,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import metadataNls from 'salesforcedx-vscode-metadata/package.nls.json';
import packageNls from '../../../package.nls.json';
import { isContainer, sharedTest as test } from '../fixtures';

// No org setup on the container's shared, persistent workbench — every test uses the boot (default)
// org, and editors/notifications are reset before each test rather than assuming a clean slate.
test.beforeEach(async ({ page }) => {
  if (isContainer) {
    await resetContainerWorkbench(page);
  }
});

// ── Spec 1: Unsupported file type ─────────────────────────────────────────────

test('Launch Apex Replay Debugger with Selected File: shows error for unsupported file type', async ({ page }) => {
  test.setTimeout(300_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('open a non-Apex file already on disk (sfdx-project.json — no host fs write needed)', async () => {
    if (!isContainer) {
      await setupMinimalOrgAndAuth(page);
    }
    await ensureSecondarySideBarHidden(page);

    // sfdx-project.json ships at the root of both the desktop scratch workspace and the container's
    // seeded fixture, so it's a non-Apex file guaranteed to already exist on disk in both modes —
    // no workspaceDir write needed.
    await openFileByName(page, 'sfdx-project.json');
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="sfdx-project.json"]`);
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

test('Update Checkpoints in Org: shows warning when no checkpoints are enabled', async ({ page }) => {
  test.setTimeout(300_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup (no checkpoints toggled)', async () => {
    if (!isContainer) {
      await setupMinimalOrgAndAuth(page);
    }
    await ensureSecondarySideBarHidden(page);
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

const accountServiceContent = (className: string) =>
  [
    `public with sharing class ${className} {`,
    '  public Account createAccount(String name) {',
    '    Account acct = new Account(Name = name);',
    '    return acct;',
    '  }',
    '}'
  ].join('\n');

test('Update Checkpoints in Org: shows error when more than 5 checkpoints are enabled', async ({ page }) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Six classes, one checkpoint per class → exceeds limit of 5. On the container's shared, persistent
  // workbench, names carry a per-run suffix so they never collide with classes left by a prior run;
  // desktop gets a fresh scratch org and workspace every run, so plain names are fine there (and
  // avoid a Quick Open fuzzy-match race that longer, near-identical-prefix names can trigger).
  const classCount = 6;
  const uid = Date.now().toString(36);
  const classNames = isContainer
    ? Array.from({ length: classCount }, (_, i) => `AccountService_${uid}_${i + 1}`)
    : Array.from({ length: classCount }, (_, i) => `AccountService${i + 1}`);

  await test.step('setup and deploy 6 Apex classes', async () => {
    if (!isContainer) {
      await setupMinimalOrgAndAuth(page);
    }
    await ensureSecondarySideBarHidden(page);

    for (const className of classNames) {
      await createApexClass(page, className, accountServiceContent(className));
    }

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await executeCommandWithCommandPalette(
      page,
      metadataNls.project_deploy_start_ignore_conflicts_default_org_text as string
    );
    await waitForOutputChannelText(page, { expectedText: 'Starting metadata deployment', timeout: 90_000 });
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
