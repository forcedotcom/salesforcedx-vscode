/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  resetContainerWorkbench,
  saveScreenshot,
  selectQuickInputOption,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForQuickInputFirstOption,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import { messages } from '../../../src/messages/i18n';
import packageNls from '../../../package.nls.json';
import { isContainer, multiPackageNoOrgTest, test as containerTest } from '../fixtures';

// Desktop scaffolds a two-package workspace on disk; the container runs this in its multi-package
// phase, whose re-seeded mount (container-multipackage) has the same packageDirectories. The
// container's boot-authed org doesn't matter here: the picker only reads sfdx-project.json.
const test = isContainer ? containerTest : multiPackageNoOrgTest;

// File-level so web skips before the beforeEach hook runs.
test.skip(
  !isContainer && process.env.VSCODE_DESKTOP !== '1',
  'requires desktop filesystem to set up multi-package workspace'
);

// Runs against a fresh desktop instance and against the one shared, serial container workbench
// alike: waitForVSCodeWorkbench is a no-op once ready, and resetContainerWorkbench's cleanup is a
// harmless best-effort on a fresh instance.
test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await resetContainerWorkbench(page);
});

test('Apex Generate Class: both package directory classes folders appear in output directory picker', async ({
  page
}) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique name so repeated runs on the shared container workbench never collide with a prior scaffold.
  const className = `MultiPkgDirTest${Date.now()}`;

  await test.step('setup', async () => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
  });

  await test.step('command is present', async () => {
    await verifyCommandExists(page, packageNls.apex_generate_class_text, 120_000);
  });

  await test.step('run Apex Generate Class command', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_generate_class_text);
    await saveScreenshot(page, 'step.command-triggered.png');
  });

  await test.step('select template in QuickPick', async () => {
    await selectQuickInputOption(page, 'DefaultApexClass');
    await saveScreenshot(page, 'step.template-selected.png');
  });

  await test.step('enter class name in InputBox', async () => {
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await quickInput.getByText(messages.apex_class_name_prompt).waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type(className);
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step.class-name-entered.png');
  });

  await test.step('both package directory classes folders appear as choices', async () => {
    await waitForQuickInputFirstOption(page);
    await saveScreenshot(page, 'step.directory-prompt-visible.png');

    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    const rows = quickInput.locator(QUICK_INPUT_LIST_ROW);

    const forceAppRow = rows.filter({ hasText: 'force-app/main/default/classes' });
    const extraPkgRow = rows.filter({ hasText: 'extra-pkg/classes' });

    await expect(forceAppRow, 'force-app/main/default/classes should appear as a choice').toBeVisible({
      timeout: 10_000
    });
    await expect(extraPkgRow, 'extra-pkg/classes should appear as a choice').toBeVisible({
      timeout: 10_000
    });

    await saveScreenshot(page, 'step.both-dirs-visible.png');
    // Escape the picker without scaffolding — this spec only proves the choices appear.
    await page.keyboard.press('Escape');
    await quickInput.waitFor({ state: 'hidden', timeout: 10_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
