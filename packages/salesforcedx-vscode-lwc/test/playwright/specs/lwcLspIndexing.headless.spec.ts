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
import { createLwc, openLwcFile, waitForLwcLspReady } from '../utils/lwcUtils';

test.beforeEach(async ({ page }) => {
  // The containerTest fixture already awaited workbench readiness before handing over `page`.
  if (!isContainer) {
    await waitForVSCodeWorkbench(page);
  }
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
});

test('LWC LSP finishes indexing and shows status in status bar', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique per-run name: the container drives a single sequential workbench, so a fixed name would
  // collide with a bundle another spec (or an earlier run) already created.
  const componentName = isContainer ? `indexComp${Date.now()}` : 'indexComp';
  const htmlFile = `${componentName}.html`;

  await test.step('create Lightning Web Component', async () => {
    await createLwc(page, componentName);
  });

  await test.step('open LWC HTML file to activate language status item', async () => {
    // The language status item (lwcLanguageServerStatus) only appears for LWC html/js/ts files
    await openLwcFile(page, htmlFile);
  });

  await test.step('wait for LWC LSP to finish indexing', async () => {
    await waitForLwcLspReady(page);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
