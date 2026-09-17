/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for Visualforce template generation (ADR 0022). The web twin
 * (visualforceTemplates.headless.spec.ts) proves the "Create Visualforce Page/Component" commands
 * run against a plain Page; this proves those commands register and generate files inside the Code
 * Builder image, where the Visualforce extension runs in the Node host. Org-free: the commands only
 * scaffold local files, so no scratch org or committed fixture is needed — a fast, deterministic
 * signal that template generation works in the container.
 */

import { expect, type Page } from '@playwright/test';
import {
  activeQuickInputWidget,
  closeAllEditors,
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import packageNls from '../../../../package.nls.json';

// Generate a VF template via command palette → name → output-dir, then assert the generated file
// opens in an editor (opening `.page`/`.component` triggers `onLanguage:visualforce` activation)
// and both files land in the explorer. Shared persistent container workspace → close editors first.
const createVisualforceTemplate = async (
  page: Page,
  command: string,
  name: string,
  extension: string
): Promise<void> => {
  await test.step(`Create Visualforce ${name}`, async () => {
    await closeAllEditors(page);
    await verifyCommandExists(page, command, 30_000);
    await executeCommandWithCommandPalette(page, command);

    const quickInput = activeQuickInputWidget(page);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.type(name);
    await page.keyboard.press('Enter');

    await waitForQuickInputFirstOption(page);
    await page.keyboard.press('Enter');

    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${name}.${extension}"]`);
    await editor.waitFor({ state: 'visible', timeout: 30_000 });

    await Promise.all(
      [`${name}.${extension}`, `${name}.${extension}-meta.xml`].map(file => {
        const explorerFile = page
          .locator('[role="treeitem"]')
          .filter({ hasText: new RegExp(`${file.replaceAll('.', '\\.')}$`, 'i') });
        return expect(explorerFile, `${file} should be visible in explorer`).toBeVisible({ timeout: 15_000 });
      })
    );
    await saveScreenshot(page, `vfTemplates.container-${name}-created.png`);
  });
};

test('Create Visualforce Page (Code Builder)', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const name = `CbVfPage${Date.now()}`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'vfTemplates.container.01-ready-page.png');
  });

  await createVisualforceTemplate(page, packageNls.visualforce_generate_page_text, name, 'page');

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Create Visualforce Component (Code Builder)', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const name = `CbVfCmp${Date.now()}`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'vfTemplates.container.01-ready-component.png');
  });

  await createVisualforceTemplate(page, packageNls.visualforce_generate_component_text, name, 'component');

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
