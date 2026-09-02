/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the Aura template-creation commands (ADR 0022). The desktop twin
 * (auraTemplates.desktop.spec.ts) proves the "SFDX: Create Aura *" commands run in the Electron
 * host; this proves the same commands work inside the Code Builder image, where the container Page
 * is browser-flavored (`isDesktop()` FALSE) yet the Node host runs the Lightning extension. Org-free
 * and self-seeding: each test creates a bundle via a Create Aura command with a unique Date.now()
 * name (the container workbench is shared and persistent) and asserts the generated files appear in
 * the Explorer.
 */

import { containerTest as test } from '../../fixtures/containerFixtures';
import { expect, type Page } from '@playwright/test';
import {
  clearAllNotifications,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  verifyCommandExists,
  closeWelcomeTabs,
  executeCommandWithCommandPalette,
  validateNoCriticalErrors,
  saveScreenshot,
  QUICK_INPUT_WIDGET,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../../package.nls.json';

test.describe('Aura Templates (Code Builder)', () => {
  let consoleErrors: ReturnType<typeof setupConsoleMonitoring>;
  let networkErrors: ReturnType<typeof setupNetworkMonitoring>;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);
    consoleErrors = setupConsoleMonitoring(page);
    networkErrors = setupNetworkMonitoring(page);
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await clearAllNotifications(page);
  });

  const createAuraTemplate = async (page: Page, command: string, name: string, expectedFiles: string[]) => {
    await test.step(`Create Aura ${name}`, async () => {
      await verifyCommandExists(page, command, 30_000);
      await executeCommandWithCommandPalette(page, command);

      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
      await page.keyboard.type(name);
      await page.keyboard.press('Enter');

      await waitForQuickInputFirstOption(page);
      await page.keyboard.press('Enter');

      await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 15_000 });

      for (const file of expectedFiles) {
        const explorerFile = page.locator('[role="treeitem"]').filter({ hasText: new RegExp(`${file}$`, 'i') });
        await expect(explorerFile).toBeVisible();
      }
      await saveScreenshot(page, `aura-${name}-created.png`);
    });
  };

  test('Create Aura App', async ({ page }) => {
    const name = `AuraApp${Date.now()}`;
    await createAuraTemplate(page, packageNls.lightning_generate_app_text, name, [
      `${name}.app`,
      `${name}.app-meta.xml`,
      `${name}Controller.js`,
      `${name}Helper.js`,
      `${name}Renderer.js`
    ]);
  });

  test('Create Aura Component', async ({ page }) => {
    const name = `AuraCmp${Date.now()}`;
    await createAuraTemplate(page, packageNls.lightning_generate_aura_component_text, name, [
      `${name}.cmp`,
      `${name}.cmp-meta.xml`,
      `${name}Controller.js`,
      `${name}Helper.js`,
      `${name}Renderer.js`
    ]);
  });

  test('Create Aura Event', async ({ page }) => {
    const name = `AuraEvent${Date.now()}`;
    await createAuraTemplate(page, packageNls.lightning_generate_event_text, name, [
      `${name}.evt`,
      `${name}.evt-meta.xml`
    ]);
  });

  test('Create Aura Interface', async ({ page }) => {
    const name = `AuraIntf${Date.now()}`;
    await createAuraTemplate(page, packageNls.lightning_generate_interface_text, name, [
      `${name}.intf`,
      `${name}.intf-meta.xml`
    ]);
  });

  test.afterEach(async () => {
    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
