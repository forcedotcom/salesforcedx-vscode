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
import { assertLwcSfdxTypingsGenerated, createLwc, openLwcFile, waitForLwcLspReady } from '../utils/lwcUtils';

test.beforeEach(async ({ page }) => {
  // The containerTest fixture already awaited workbench readiness before handing over `page`.
  if (!isContainer) {
    await waitForVSCodeWorkbench(page);
  }
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
});

test('LWC LSP writes SFDX typings under .sfdx/typings/lwc with expected module headers', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique per-run name: the container drives a single sequential workbench, so a fixed name would
  // collide with a bundle another spec (or an earlier run) already created.
  const componentName = isContainer ? `typingsProbe${Date.now()}` : 'typingsProbe';

  await test.step('create bundle and wait for LSP indexing (triggers typings copy into workspace)', async () => {
    await createLwc(page, componentName);
    await openLwcFile(page, `${componentName}.js`);
    await waitForLwcLspReady(page);
  });

  await test.step('open each generated .d.ts and assert first-line module declarations', async () => {
    await assertLwcSfdxTypingsGenerated(page);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
