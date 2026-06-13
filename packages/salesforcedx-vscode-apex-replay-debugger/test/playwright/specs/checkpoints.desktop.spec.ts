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
  openFileByName,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import metadataNls from 'salesforcedx-vscode-metadata/package.nls.json';
import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

test('Checkpoints: Toggle Checkpoint and Update Checkpoints in Org', async ({ page }) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const accountServiceContent = [
    'public with sharing class AccountService {',
    '  public Account createAccount(String accountName, String accountNumber, String tickerSymbol) {',
    '    Account newAcct = new Account(',
    '      Name = accountName,',
    '      AccountNumber = accountNumber,',
    '      TickerSymbol = accountNumber',
    '    );',
    '    return newAcct;',
    '  }',
    '}'
  ].join('\n');

  await test.step('setup minimal org and deploy AccountService', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
    await createApexClass(page, 'AccountService', accountServiceContent);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await executeCommandWithCommandPalette(
      page,
      metadataNls.project_deploy_start_ignore_conflicts_default_org_text as string
    );
    await waitForOutputChannelText(page, { expectedText: 'Starting metadata deployment', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: 120_000 });
  });

  await test.step('toggle checkpoint at the `return newAcct;` line of AccountService.cls', async () => {
    await openFileByName(page, 'AccountService.cls');

    // Click directly on the `return newAcct;` line text — `sfToggleCheckpoint` reads
    // `vscode.window.activeTextEditor.selection.start.line`, so the caret must sit on a valid
    // Apex statement (not the closing `}` on line 10). Scope to the AccountService editor so
    // the click can't land in a different editor's view-lines.
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="AccountService.cls"]`);
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    const returnLine = editor.locator('.view-line').filter({ hasText: 'return newAcct;' }).first();
    await expect(returnLine).toBeVisible({ timeout: 15_000 });
    await returnLine.click();

    // Use preserveSelection so the palette opener does not click the workbench root
    // (a workbench-center click can land in the editor and reset the cursor before the
    // Toggle Checkpoint command reads `activeTextEditor.selection.start.line`).
    await executeCommandWithCommandPalette(page, packageNls.sf_toggle_checkpoint as string, undefined, {
      preserveSelection: true
    });

    // After Toggle Checkpoint, VS Code renders a conditional breakpoint glyph in the gutter
    const checkpointGlyph = page.locator('div.codicon-debug-breakpoint-conditional');
    await expect(checkpointGlyph.first()).toBeVisible({ timeout: 15_000 });
    await saveScreenshot(page, 'step.checkpoint-toggled.png');
  });

  await test.step('update checkpoints in org', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Replay Debugger');
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.sf_update_checkpoints_in_org as string);

    await waitForOutputChannelText(page, {
      expectedText: 'SFDX: Update Checkpoints in Org, Step 6 of 6: Confirming successful checkpoint creation',
      timeout: 120_000
    });
    await waitForOutputChannelText(page, {
      expectedText: 'Ended SFDX: Update Checkpoints in Org',
      timeout: 60_000
    });
    await saveScreenshot(page, 'step.checkpoints-updated.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
