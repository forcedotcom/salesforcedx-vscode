/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  EDITOR_WITH_URI,
  openFileByName,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import { test } from '../fixtures';
import { waitForApexLspReady } from '../utils/apexLspUtils';

test('Apex LSP: hover shows method signature for SayHello', async ({ page, workspaceDir }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('open ExampleClass.cls and wait for Apex LSP ready', async () => {
    await openFileByName(page, 'ExampleClass.cls');
    await waitForApexLspReady(page, workspaceDir);
  });

  await test.step('hover SayHello token and verify method signature in hover card', async () => {
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="ExampleClass.cls"]`);
    const sayHelloToken = editor
      .locator('.view-lines span')
      .filter({ hasText: /^SayHello$/ })
      .first();
    await sayHelloToken.waitFor({ state: 'visible', timeout: 10_000 });
    await sayHelloToken.hover();

    const hoverCard = page.locator('.monaco-hover');
    await expect(hoverCard, 'Apex LSP hover card should appear with SayHello method signature').toBeVisible({
      timeout: 20_000
    });
    // Apex LSP returns the full method signature including return type and parameter types
    await expect(hoverCard).toContainText('String SayHello(String name)', { timeout: 10_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
