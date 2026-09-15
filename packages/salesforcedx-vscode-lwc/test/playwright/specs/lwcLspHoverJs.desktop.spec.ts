/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  EDITOR_WITH_URI,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  setupConsoleMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import { createLwc, openLwcFile, waitForLwcLspReady } from '../utils/lwcUtils';

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
});

test('LWC LSP provides hover type information for LightningElement in JS files', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create Lightning Web Component', async () => {
    await createLwc(page, 'hoverJsComp');
  });

  await test.step('open HTML file and wait for LWC LSP to finish indexing, then switch to JS', async () => {
    await openLwcFile(page, 'hoverJsComp.html');
    await waitForLwcLspReady(page);
    await openLwcFile(page, 'hoverJsComp.js');
  });

  await test.step('hover over LightningElement in the import statement and verify hover card', async () => {
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="hoverJsComp.js"]`);
    await editor.waitFor({ state: 'visible', timeout: 10_000 });
    const lightningToken = editor
      .locator('.view-lines span')
      .filter({ hasText: /^LightningElement$/ })
      .first();
    await lightningToken.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(async () => {
      await page.keyboard.press('Escape');
      const editorBox = await editor.boundingBox();
      await page.mouse.move((editorBox?.x ?? 0) + 10, (editorBox?.y ?? 0) + (editorBox?.height ?? 0) - 10);
      await lightningToken.hover();
      await expect(
        page.locator('.monaco-hover').filter({ hasText: /LightningElement/ }),
        'hover card should show LightningElement type information from the LWC engine typings'
      ).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 45_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
