/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  QUICK_INPUT_WIDGET,
  openFileByName,
  setupConsoleMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import { outlineTest as test } from '../fixtures/outlineFixtures';

test('Apex Outline: document symbols from external TS LS (desktop)', async ({ page }) => {
  // timeout comes from playwright.config.desktop.ts (timeout: 360_000)
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('open ExampleClass.cls', async () => {
    await openFileByName(page, 'ExampleClass.cls');
    // Wait for the editor tab to become active
    const tab = page.getByRole('tab', { name: 'ExampleClass.cls', exact: true }).first();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
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
    // Open command palette and show output channels
    await page.keyboard.press('F1');
    const quickInput = page.locator(`${QUICK_INPUT_WIDGET} input[type="text"]`);
    await expect(quickInput).toBeVisible({ timeout: 5000 });
    await quickInput.fill('Output: Focus on Output View');
    await page.keyboard.press('Enter');

    // The jorje-based "Apex Language Server" output channel should not exist.
    // If it does exist, its content must not contain 'Prelude' (jorje startup marker).
    const outputPanel = page.locator('.output-view, [id="workbench.panel.output"]');
    await expect(outputPanel).toBeVisible({ timeout: 10_000 });

    // Check output channel selector for jorje channel — assert unconditionally
    const channelSelector = page.locator('.output-view .monaco-select-box, [id="workbench.panel.output"] select');
    const channelText = await channelSelector.textContent({ timeout: 10_000 });
    expect(channelText, 'Expected to read output channel list but got empty string').toBeTruthy();
    // The jorje "Apex Language Server" output channel must not appear
    expect(channelText).not.toContain('Apex Language Server');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
