/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test, expect } from '@playwright/test';
import {
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  setupConsoleMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import { assertJorjeNotLoaded } from '../utils/apexLspUtils';

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
});

// Document symbols require the external Apex LS to run in the browser. salesforce.apex-language-server-extension
// v0.4.0 ships a Node entry point (`main`) only — no `browser` entry — so VS Code for the Web never activates it and
// the Outline reports "No symbols found in document" (confirmed via Playwright trace; the web build of
// @vscode/test-web only loads extensions that declare a `browser` entry). The web symbol assertion therefore cannot
// pass with the shipping extension. Skip until the external LS ships a web build; the desktop spec covers the symbol
// behavior. The jorje-absence regression is still guarded on desktop (apexOutline.desktop.spec.ts).
test.skip('Apex Outline: document symbols from external TS LS (web)', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('open ExampleClass.cls from Explorer', async () => {
    const explorerTree = page.locator('[id="workbench.view.explorer"]');
    await expect(explorerTree).toBeVisible({ timeout: 30_000 });

    // The web headless workspace indexes files lazily, so Quick Open cannot resolve the path.
    // Expand the top folder; VS Code compacts the single-child chain (force-app/main/default/classes)
    // so one click reveals the nested class file.
    const forceApp = page.getByRole('treeitem', { name: 'force-app', exact: true });
    await expect(forceApp).toBeVisible({ timeout: 30_000 });
    if ((await forceApp.getAttribute('aria-expanded')) !== 'true') {
      await forceApp.click();
    }

    const classFile = page.getByRole('treeitem', { name: /ExampleClass\.cls$/ });
    await expect(classFile).toBeVisible({ timeout: 30_000 });
    await classFile.dblclick();

    const tab = page.getByRole('tab', { name: 'ExampleClass.cls' });
    await expect(tab).toBeVisible({ timeout: 10_000 });
  });

  await test.step('focus Outline view and verify symbols', async () => {
    // Expand the OUTLINE section in the Explorer. The command-palette "Focus on Outline View"
    // command title is not reliably matchable across VS Code versions (yields "No matching
    // results"), so click the section header directly — works identically in web and desktop.
    const outlineHeader = page.getByRole('button', { name: 'Outline Section', exact: true });
    await expect(outlineHeader).toBeVisible({ timeout: 30_000 });
    if ((await outlineHeader.getAttribute('aria-expanded')) !== 'true') {
      await outlineHeader.click();
    }

    // Poll for expected symbols in the Outline tree. Scope to the Outline pane so the
    // assertion cannot match the Explorer file node opened above or the editor breadcrumb.
    const outline = page.locator('.outline-pane');
    await expect(async () => {
      await expect(outline.getByRole('treeitem', { name: /ExampleClass/ })).toBeVisible();
      await expect(outline.getByRole('treeitem', { name: /SayHello/ })).toBeVisible();
    }).toPass({ timeout: 120_000 });
  });

  await test.step('verify jorje is NOT loaded', async () => {
    // jorje cannot run in browser (no JVM), but assert absence to catch accidental bundling regressions
    await assertJorjeNotLoaded(page);
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
