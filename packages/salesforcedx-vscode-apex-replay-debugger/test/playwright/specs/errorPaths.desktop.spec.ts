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
  saveScreenshot,
  selectOutputChannel,
  setupMinimalOrgAndAuth,
  waitForNotification,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import fs from 'node:fs';
import path from 'node:path';
import metadataNls from 'salesforcedx-vscode-metadata/package.nls.json';
import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

// ── Spec 1: Unsupported file type ─────────────────────────────────────────────

test('Launch Apex Replay Debugger with Selected File: shows error for unsupported file type', async ({
  page,
  workspaceDir
}) => {
  test.setTimeout(300_000);

  await test.step('setup minimal org and open a non-Apex .txt file', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);

    // Write a plain .txt file directly to the workspace — no deployment needed
    const txtPath = path.join(workspaceDir, 'force-app', 'main', 'default', 'unsupported.txt');
    fs.mkdirSync(path.dirname(txtPath), { recursive: true });
    fs.writeFileSync(txtPath, 'this is not an apex file');

    await openFileByName(page, 'unsupported.txt');
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="unsupported.txt"]`);
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
});

// ── Spec 2: No enabled checkpoints ───────────────────────────────────────────

test('Update Checkpoints in Org: shows warning when no checkpoints are enabled', async ({ page }) => {
  test.setTimeout(300_000);

  await test.step('setup minimal org with an Apex class (no checkpoints toggled)', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
    await ensureOutputPanelOpen(page);
  });

  await test.step('run "Update Checkpoints in Org" with no checkpoints — must show warning notification', async () => {
    await executeCommandWithCommandPalette(page, packageNls.sf_update_checkpoints_in_org as string);
    await waitForNotification(page, /You don't have any checkpoints enabled/, { timeout: 30_000 });
    await saveScreenshot(page, 'step.no-enabled-checkpoints-warning.png');
  });
});

// ── Spec 3: Checkpoint limit exceeded ────────────────────────────────────────

const accountServiceContent = (i: number) =>
  [
    `public with sharing class AccountService${i} {`,
    `  public Account createAccount${i}(String name) {`,
    '    Account acct = new Account(Name = name);',
    '    return acct;',
    '  }',
    '}'
  ].join('\n');

test('Update Checkpoints in Org: shows error when more than 5 checkpoints are enabled', async ({ page }) => {
  test.setTimeout(600_000);

  // Six classes, one checkpoint per class → exceeds limit of 5
  const classCount = 6;
  const classNames = Array.from({ length: classCount }, (_, i) => `AccountService${i + 1}`);

  await test.step('setup minimal org and deploy 6 Apex classes', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);

    for (let i = 0; i < classCount; i++) {
      await createApexClass(page, classNames[i], accountServiceContent(i + 1));
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
});

// ── Spec 4: Debug test — no results / no debug log ───────────────────────────

const emptyTestClassContent = [
  '@IsTest',
  'public class EmptyTestClass {',
  '  @IsTest',
  '  static void emptyTest() {',
  '    // intentionally empty — no System.debug() so no log is generated',
  '  }',
  '}'
].join('\n');

test('Debug Test: shows error notifications for no results and missing debug log', async ({ page }) => {
  test.setTimeout(600_000);

  await test.step('setup minimal org and deploy test classes', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);

    await createApexClass(page, 'EmptyTestClass', emptyTestClassContent);

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await executeCommandWithCommandPalette(
      page,
      metadataNls.project_deploy_start_ignore_conflicts_default_org_text as string
    );
    await waitForOutputChannelText(page, { expectedText: 'Starting metadata deployment', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: 120_000 });
    await saveScreenshot(page, 'setup.test-class-deployed.png');
  });

  await test.step('debug EmptyTestClass — no System.debug means no debug log attached to result', async () => {
    await openFileByName(page, 'EmptyTestClass.cls');

    // Trigger via sf.test.view.debugTests which calls setupAndDebugTests
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    await expect(page.getByText('EmptyTestClass').first()).toBeVisible({ timeout: 60_000 });

    // Expand tree and click Debug Tests on the class row
    const classRow = page.getByRole('treeitem', { name: /EmptyTestClass/i });
    await classRow.waitFor({ state: 'visible', timeout: 30_000 });
    await expect(async () => {
      await classRow.click({ force: true });
      await classRow.hover({ force: true });
      const debugButton = classRow.getByRole('button', { name: /^Debug Test/ });
      await debugButton.waitFor({ state: 'visible', timeout: 3000 });
      await debugButton.click({ force: true });
    }).toPass({ timeout: 30_000 });

    const errorNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /No debug log associated with test results/ })
      .first();
    await expect(errorNotification).toBeVisible({ timeout: 60_000 });
    await saveScreenshot(page, 'step.no-debug-log-error.png');
  });
});
