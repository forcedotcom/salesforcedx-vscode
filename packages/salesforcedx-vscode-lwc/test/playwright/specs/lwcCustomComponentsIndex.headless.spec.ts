/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  closeWelcomeTabs,
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
  // Unique per-run name: the container's shared workbench would otherwise collide with a bundle another
  // spec (or an earlier run) already created. Harmless where each test gets a fresh workspace.
  const bundleCamel = `idxCmp${Date.now()}`;

  await test.step('create a bundle and wait for LWC language server indexing', async () => {
    await createLwc(page, bundleCamel);
    await openLwcFile(page, `${bundleCamel}.js`);
    await waitForLwcLspReady(page);
  });

  await test.step('custom-components.json lists the new module path', async () => {
    // Search via the Find widget rather than `.view-lines`: the container's shared workspace grows this index
    // large enough that Monaco virtualizes the new entry off-screen. Reopen on each attempt because the LSP
    // rewrites the file asynchronously after bundle creation. Separators match `/` or a (JSON-escaped)
    // backslash, since Windows stores backslash paths.
    await assertOpenEditorContainsText(
      page,
      new RegExp(`lwc[\\\\/]+${bundleCamel}[\\\\/]+${bundleCamel}\\.js`),
      openSfdxCustomComponentsJson
    );
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
