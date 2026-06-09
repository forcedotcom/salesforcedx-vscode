/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test, expect } from '@playwright/test';
import {
  QUICK_INPUT_WIDGET,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  setupConsoleMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
});

test('Apex Outline: document symbols from external TS LS (web)', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('open ExampleClass.cls from Explorer', async () => {
    // Expand Explorer sidebar and open the file
    const explorerTree = page.locator('[id="workbench.view.explorer"]');
    await expect(explorerTree).toBeVisible({ timeout: 30_000 });

    // Navigate to the file through the tree
    const classFile = page.getByRole('treeitem', { name: /ExampleClass\.cls$/ });
    await expect(classFile).toBeVisible({ timeout: 30_000 });
    await classFile.dblclick();

    // Wait for the editor tab to appear
    const tab = page.getByRole('tab', { name: 'ExampleClass.cls' });
    await expect(tab).toBeVisible({ timeout: 10_000 });
  });

  await test.step('focus Outline view and verify symbols', async () => {
    // Open command palette and focus outline view
    await page.keyboard.press('F1');
    const quickInput = page.locator(`${QUICK_INPUT_WIDGET} input[type="text"]`);
    await expect(quickInput).toBeVisible({ timeout: 5000 });
    await quickInput.fill('Focus on Outline View');
    await page.keyboard.press('Enter');

    // Poll for expected symbols in the Outline tree
    await expect(async () => {
      const classNode = page.getByRole('treeitem', { name: /ExampleClass/ });
      await expect(classNode).toBeVisible();
      const methodNode = page.getByRole('treeitem', { name: /SayHello/ });
      await expect(methodNode).toBeVisible();
    }).toPass({ timeout: 120_000 });
  });

  await test.step('verify jorje is NOT loaded', async () => {
    // jorje cannot run in browser (no JVM), but assert absence to catch accidental bundling regressions
    await page.keyboard.press('F1');
    const quickInput = page.locator(`${QUICK_INPUT_WIDGET} input[type="text"]`);
    await expect(quickInput).toBeVisible({ timeout: 5000 });
    await quickInput.fill('Output: Focus on Output View');
    await page.keyboard.press('Enter');

    const outputPanel = page.locator('.output-view, [id="workbench.panel.output"]');
    await expect(outputPanel).toBeVisible({ timeout: 10_000 });

    // Check output channel selector — jorje "Apex Language Server" must not appear
    const channelSelector = page.locator('.output-view .monaco-select-box, [id="workbench.panel.output"] select');
    const channelText = await channelSelector.textContent({ timeout: 10_000 });
    expect(channelText, 'Expected to read output channel list but got empty string').toBeTruthy();
    expect(channelText).not.toContain('Apex Language Server');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
