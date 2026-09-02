/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the LWC scaffolding command (ADR 0022). The web twin
 * (lwcGenerateComponent.headless.spec.ts) proves this runs against a plain Page; this proves the
 * same command works inside the Code Builder image, where the LWC extension runs in the Node host
 * alongside the full installed extension set. Pure local generation — no org needed — so it is a
 * fast, deterministic signal that the extension activated and its command is wired in the container.
 */

import { expect } from '@playwright/test';
import {
  activeQuickInputWidget,
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
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

test('LWC Generate Component (Code Builder): creates a new LWC via command palette', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // A per-run suffix keeps re-runs against the same live container from colliding on an existing dir.
  const componentName = `cbLwc${Date.now()}`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'lwcGenerate.container.01-ready.png');
  });

  await test.step('command is present (extension activated in the Node host)', async () => {
    await verifyCommandExists(page, packageNls.lightning_generate_lwc_text, 120_000);
  });

  await test.step('create the LWC via command palette', async () => {
    await executeCommandWithCommandPalette(page, packageNls.lightning_generate_lwc_text);

    const quickInput = activeQuickInputWidget(page);
    await quickInput.waitFor({ state: 'attached', timeout: 30_000 });

    // Step 1: component type (JavaScript/TypeScript). Click the option rather than Enter — 1.116+
    // occasionally drops Enter on quick picks (PR #7193).
    await waitForQuickInputFirstOption(page);
    await activeQuickInputWidget(page).getByRole('option').first().click({ force: true });

    // Step 2: component name.
    await activeQuickInputWidget(page)
      .getByText(/Enter Lightning Web Component name/i)
      .waitFor({ state: 'attached', timeout: 10_000 });
    await page.keyboard.type(componentName);
    await page.keyboard.press('Enter');

    // Step 3: output directory (default force-app/main/default/lwc).
    await waitForQuickInputFirstOption(page);
    await activeQuickInputWidget(page).getByRole('option').first().click({ force: true });

    // Step 4: the new component's .js opens.
    await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 20_000 });
    await saveScreenshot(page, 'lwcGenerate.container.02-created.png');
  });

  await test.step('verify the component files were scaffolded', async () => {
    const editorTab = page.locator('[role="tab"]').filter({ hasText: new RegExp(`${componentName}\\.js`, 'i') });
    await expect(editorTab).toBeVisible({ timeout: 5000 });

    const editorText = page.locator('.view-lines').first();
    await expect(editorText).toContainText('import { LightningElement }', { timeout: 5000 });

    // Folder auto-expands when the .js opens — the sibling files are visible in the Explorer tree.
    await expect(page.getByRole('treeitem', { name: new RegExp(`${componentName}\\.html$`, 'i') })).toBeVisible({
      timeout: 5000
    });
    await expect(
      page.getByRole('treeitem', { name: new RegExp(`${componentName}\\.js-meta\\.xml$`, 'i') })
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('treeitem', { name: '__tests__' })).toBeVisible({ timeout: 5000 });
    await saveScreenshot(page, 'lwcGenerate.container.03-files-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
