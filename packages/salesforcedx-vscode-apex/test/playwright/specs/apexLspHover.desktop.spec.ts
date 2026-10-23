/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  EDITOR_WITH_URI,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import { isContainer, sharedTest as test } from '../fixtures';
import { openApexFileFromExplorerTree, waitForApexLspReady } from '../utils/containerApexLspUtils';

// force-app/main/default/classes on desktop (fixtures/desktopFixtures.ts seeds it there); the
// container's bind-mounted fixture project uses the same layout, so the path is shared.
const CLASSES_DIR = ['force-app', 'main', 'default', 'classes'];

test('Apex LSP: hover shows method signature for SayHello', async ({ page }) => {
  if (isContainer) {
    test.setTimeout(3 * 60 * 1000);
  }
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('open ExampleClass.cls and wait for Apex LSP ready', async () => {
    // openApexFileFromExplorerTree retries the whole open — load-bearing in the container, where
    // the Explorer tree hydrates progressively over a browser round-trip; harmless on desktop.
    await openApexFileFromExplorerTree(page, 'ExampleClass.cls', CLASSES_DIR);
    // UI-only readiness (the "Indexing complete" language-status button) — sufficient here; the
    // disk-based StandardApexLibrary check only matters for apexLspRestart's clean-DB verification.
    await waitForApexLspReady(page);
    await saveScreenshot(page, 'apexLspHover.01-ready.png');
  });

  await test.step('hover SayHello token and verify method signature in hover card', async () => {
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="ExampleClass.cls"]`);
    const sayHelloToken = editor
      .locator('.view-lines span')
      .filter({ hasText: /^SayHello$/ })
      .first();
    await sayHelloToken.waitFor({ state: 'visible', timeout: 10_000 });
    await sayHelloToken.hover();

    const hoverCard = page.locator('.monaco-hover:not(.hidden)').filter({ hasText: 'SayHello' });
    await expect(hoverCard, 'Apex LSP hover card should appear with SayHello method signature').toBeVisible({
      timeout: 20_000
    });
    // Apex LSP returns the full method signature: return type, declaring class, and parameter types
    await expect(hoverCard).toContainText('String ExampleClass.SayHello(String name)', { timeout: 10_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
