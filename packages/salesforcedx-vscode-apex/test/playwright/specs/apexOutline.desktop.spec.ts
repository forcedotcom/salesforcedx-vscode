/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { openFileByName, setupConsoleMonitoring, validateNoCriticalErrors } from '@salesforce/playwright-vscode-ext';

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
    // Expand the OUTLINE section in the Explorer. The command-palette "Focus on Outline View"
    // command title is not reliably matchable across VS Code versions (yields "No matching
    // results"), so click the section header directly — works identically in web and desktop.
    const outlineHeader = page.getByRole('button', { name: 'Outline Section', exact: true });
    await expect(outlineHeader).toBeVisible({ timeout: 30_000 });
    const expanded = await outlineHeader.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await outlineHeader.click();
    }

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
