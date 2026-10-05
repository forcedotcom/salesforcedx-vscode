/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { isContainer, sharedTest as test } from '../fixtures';
import {
  assertOpenEditorContainsText,
  createLwc,
  openLwcFile,
  openSfdxCustomComponentsJson,
  waitForLwcLspReady
} from '../utils/lwcUtils';

test.beforeEach(async ({ page }) => {
  // The containerTest fixture already awaited workbench readiness before handing over `page`.
  if (!isContainer) {
    await waitForVSCodeWorkbench(page);
  }
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
});

test('New LWC bundle updates .sfdx/indexes/lwc/custom-components.json without reloading VS Code', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique per-run name: the container drives a single sequential workbench, so a fixed name would
  // collide with a bundle another spec (or an earlier run) already created.
  const bundleCamel = isContainer ? `idxCmp${Date.now()}` : 'idxCmp';

  await test.step('create a bundle and wait for LWC language server indexing', async () => {
    await createLwc(page, bundleCamel);
    await openLwcFile(page, `${bundleCamel}.js`);
    await waitForLwcLspReady(page);
  });

  await test.step('custom-components.json lists the new module path', async () => {
    await openSfdxCustomComponentsJson(page);
    const posix = `lwc/${bundleCamel}/${bundleCamel}.js`;
    const assertCustomComponentsIndexContainer = async (): Promise<void> => {
      // The container is Linux, so the index stores a posix module path. Search the full editor model via
      // the Find widget rather than `.view-lines` textContent: the shared workbench accumulates many bundles,
      // so this index file is large and Monaco virtualizes the viewport, keeping the new entry off-screen.
      // Pass `openSfdxCustomComponentsJson` as the reopen hook: the LSP rewrites the index asynchronously
      // after bundle creation, so each poll attempt reloads the file from disk until the new entry lands.
      await assertOpenEditorContainsText(page, posix, openSfdxCustomComponentsJson);
    };
    const assertCustomComponentsIndexDesktop = async (): Promise<void> => {
      // Desktop CI can run on Windows, where the index stores a backslash module path instead.
      const editor = page.locator(`${EDITOR_WITH_URI}[data-uri*="custom-components.json"]`);
      const winish = `lwc\\${bundleCamel}\\${bundleCamel}.js`;
      await expect(async () => {
        const text = (await editor.locator('.view-lines').textContent()) ?? '';
        expect(text.includes(posix) || text.includes(winish)).toBe(true);
      }).toPass({ timeout: 90_000 });
    };
    await (isContainer ? assertCustomComponentsIndexContainer : assertCustomComponentsIndexDesktop)();
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
