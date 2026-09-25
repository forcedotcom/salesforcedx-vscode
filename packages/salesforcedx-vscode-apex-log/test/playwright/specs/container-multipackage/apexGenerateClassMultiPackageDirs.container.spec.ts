/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the multi-`packageDirectories` output-directory picker. The desktop twin
 * (apexGenerateClassMultiPackageDirs.headless.spec.ts) builds a two-package workspace on the desktop
 * filesystem and asserts SFDX: Create Apex Class lists BOTH package dirs' `classes` folders; that
 * spec is desktop-only (it needs a writable disk to scaffold the workspace). This proves the same
 * gate inside the Code Builder image.
 *
 * Runs against the MULTI-PACKAGE workspace shape: the orchestrator opens the standard single-package
 * DX fixture first (for ./specs/container), then re-seeds coder.json to the container-multipackage
 * mount + restarts and runs THIS suite (test:container:multipackage). It re-runs the extension verify
 * gate after that restart, so reaching a spec here means the apex-log extension IS installed — both
 * picker rows appearing is the real multi-package behavior, not a load failure.
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
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import { messages } from '../../../../src/messages/i18n';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

// Shared persistent workbench: reset editors + notifications between specs so the picker flow starts
// from a known state.
test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
});

test('Apex Generate Class (Code Builder): both package directory classes folders appear in the output directory picker', async ({
  page
}) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique name so repeated runs on the shared workbench never collide with a prior scaffold.
  const className = `MultiPkgDirTest${Date.now()}`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'apexGenerateClassMultiPackageDirs.container.01-ready.png');
  });

  await test.step('command is present', async () => {
    await verifyCommandExists(page, packageNls.apex_generate_class_text, 120_000);
  });

  await test.step('run Apex Generate Class command', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_generate_class_text);
    await saveScreenshot(page, 'apexGenerateClassMultiPackageDirs.container.02-command-triggered.png');
  });

  await test.step('select template in QuickPick', async () => {
    await selectQuickInputOption(page, 'DefaultApexClass');
    await saveScreenshot(page, 'apexGenerateClassMultiPackageDirs.container.03-template-selected.png');
  });

  await test.step('enter class name in InputBox', async () => {
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await quickInput.getByText(messages.apex_class_name_prompt).waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type(className);
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'apexGenerateClassMultiPackageDirs.container.04-class-name-entered.png');
  });

  await test.step('both package directory classes folders appear as choices', async () => {
    await waitForQuickInputFirstOption(page);
    await saveScreenshot(page, 'apexGenerateClassMultiPackageDirs.container.05-directory-prompt-visible.png');

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

    await saveScreenshot(page, 'apexGenerateClassMultiPackageDirs.container.06-both-dirs-visible.png');
    // Escape the picker without scaffolding — this spec only proves the choices appear.
    await page.keyboard.press('Escape');
    await quickInput.waitFor({ state: 'hidden', timeout: 10_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
