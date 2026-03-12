/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  saveScreenshot,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForExtensionsActivated
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import packageNls from '../../../package.nls.json';

test('SOQL Builder: create query and toggle between builder and text editor', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup workbench', async () => {
    await setupMinimalOrgAndAuth(page);
    await waitForExtensionsActivated(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'setup.complete.png');
  });

  await test.step('create query in SOQL Builder', async () => {
    await executeCommandWithCommandPalette(page, packageNls.soql_builder_open_new);
    await saveScreenshot(page, 'step1.after-command.png');

    // Wait for the untitled.soql tab to appear
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: 'untitled.soql' });
    await expect(soqlTab, 'untitled.soql tab should be visible after opening SOQL Builder').toBeVisible({
      timeout: 20_000
    });
    await saveScreenshot(page, 'step1.soql-tab-visible.png');
  });

  await test.step('toggle from SOQL Builder to Text Editor', async () => {
    const toggleButton = page.getByRole('button', { name: packageNls.soql_builder_toggle });
    await expect(toggleButton, 'toggle button should be visible in editor title').toBeVisible();
    await toggleButton.click();
    await saveScreenshot(page, 'step2.after-toggle-to-text.png');

    // After toggling, a second untitled.soql tab opens (text editor alongside builder)
    const soqlTabs = page.locator('[role="tab"]').filter({ hasText: 'untitled.soql' });
    await expect(soqlTabs, 'two untitled.soql tabs should exist after toggling to text editor').toHaveCount(2, {
      timeout: 10_000
    });
    await saveScreenshot(page, 'step2.two-tabs-visible.png');
  });

  await test.step('toggle from Text Editor back to SOQL Builder', async () => {
    // We are now in the text editor view; toggle should switch focus back to the builder
    const toggleButton = page.getByRole('button', { name: packageNls.soql_builder_toggle });
    await expect(toggleButton, 'toggle button should be visible from text editor').toBeVisible();
    await toggleButton.click();
    await saveScreenshot(page, 'step3.after-toggle-to-builder.png');

    // Verify the active tab is still an untitled.soql (builder view now active)
    const activeTab = page.locator('[role="tab"][aria-selected="true"]').filter({ hasText: 'untitled.soql' });
    await expect(activeTab, 'active tab should be untitled.soql after toggling back to builder').toBeVisible({
      timeout: 10_000
    });
    await saveScreenshot(page, 'step3.builder-active.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
