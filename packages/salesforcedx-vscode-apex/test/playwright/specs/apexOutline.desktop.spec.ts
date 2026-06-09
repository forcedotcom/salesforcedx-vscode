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
import { assertJorjeNotLoaded } from '../utils/apexLspUtils';

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

    // Poll for expected symbols in the Outline tree. Scope to the Outline pane so the
    // assertion cannot match the Explorer file node or the editor breadcrumb.
    const outline = page.locator('.outline-pane');
    await expect(async () => {
      await expect(outline.getByRole('treeitem', { name: /ExampleClass/ })).toBeVisible();
      await expect(outline.getByRole('treeitem', { name: /SayHello/ })).toBeVisible();
    }).toPass({ timeout: 120_000 });
  });

  await test.step('verify jorje is NOT loaded', async () => {
    await assertJorjeNotLoaded(page);
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
