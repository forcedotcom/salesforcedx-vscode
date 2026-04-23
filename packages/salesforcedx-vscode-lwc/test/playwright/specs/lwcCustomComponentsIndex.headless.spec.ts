/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  EDITOR_WITH_URI,
  setupConsoleMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import { createLwc, openLwcFile, openSfdxCustomComponentsJson, waitForLwcLspReady } from '../utils/lwcUtils';
import { applyLwcWebScratchAuth } from '../utils/lwcWebScratchAuth';

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await applyLwcWebScratchAuth(page);
  await ensureSecondarySideBarHidden(page);
});

test('New LWC bundle updates .sfdx/indexes/lwc/custom-components.json without reloading VS Code', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);
  const bundleCamel = 'idxCmp';

  await test.step('create a bundle and wait for LWC language server indexing', async () => {
    await createLwc(page, bundleCamel);
    await openLwcFile(page, `${bundleCamel}.js`);
    await waitForLwcLspReady(page);
  });

  await test.step('custom-components.json lists the new module path', async () => {
    await openSfdxCustomComponentsJson(page);
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri*="custom-components.json"]`);
    const posix = `lwc/${bundleCamel}/${bundleCamel}.js`;
    const winish = `lwc\\${bundleCamel}\\${bundleCamel}.js`;
    await expect(async () => {
      const text = (await editor.locator('.view-lines').textContent()) ?? '';
      expect(text.includes(posix) || text.includes(winish)).toBe(true);
    }).toPass({ timeout: 90_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
