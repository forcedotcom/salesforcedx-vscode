/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the desktop Apex LSP hover twin (apexLspHover.desktop.spec.ts), per ADR 0022.
 * The desktop twin proves the jorje language server answers hover requests in Electron; this proves
 * the SAME desktop Apex LSP answers them inside the Code Builder image, where the workbench is
 * served to a browser Page but the Apex extension runs in the Node host.
 *
 * No org setup and no file seeding: the container boots with one authed org already and the fixture
 * project is bind-mounted, so ExampleClass.cls already exists on disk at
 * force-app/main/default/classes with the same layout the desktop twin seeds. We open it instead of
 * writing it.
 *
 * The desktop twin's `waitForApexLspReady(page, workspaceDir)` also polls the workspace `.sfdx`
 * folder on disk; the container's workspace lives inside the image, so we wait on the UI-only signal
 * (the "Indexing complete" language-status button) instead.
 */

import { expect, type Page } from '@playwright/test';
import {
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  openFileFromExplorerTree,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';

/**
 * UI-only Apex LSP readiness: wait for the "Indexing complete" language-status button. The desktop
 * twin also checks StandardApexLibrary on disk, but the container's workspace is inside the image
 * (and boots pre-indexed), so the button alone is the reliable in-browser signal.
 */
const waitForApexLspReady = async (page: Page): Promise<void> => {
  await expect(page.getByRole('button', { name: /Indexing complete/ })).toBeVisible({ timeout: 120_000 });
};

test('Apex LSP (Code Builder): hover shows method signature for SayHello', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'apexLspHover.container.01-ready.png');
  });

  await test.step('open ExampleClass.cls and wait for Apex LSP ready', async () => {
    await openFileFromExplorerTree(page, 'ExampleClass.cls', ['force-app', 'main', 'default', 'classes']);
    await waitForApexLspReady(page);
    await saveScreenshot(page, 'apexLspHover.container.02-lsp-ready.png');
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
    await saveScreenshot(page, 'apexLspHover.container.03-hover.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
