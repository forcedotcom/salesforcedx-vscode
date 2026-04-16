/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  assertWelcomeTabExists,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  setupConsoleMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import {
  assertLwcSfdxTypingsGenerated,
  createLwc,
  openLwcFile,
  waitForLwcLspReady
} from '../utils/lwcUtils';
import { applyLwcWebScratchAuth } from '../utils/lwcWebScratchAuth';

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await assertWelcomeTabExists(page);
  await closeWelcomeTabs(page);
  await applyLwcWebScratchAuth(page);
  await ensureSecondarySideBarHidden(page);
});

test('LWC LSP writes SFDX typings under .sfdx/typings/lwc with expected module headers', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create bundle and wait for LSP indexing (triggers typings copy into workspace)', async () => {
    await createLwc(page, 'typingsProbe');
    await openLwcFile(page, 'typingsProbe.js');
    await waitForLwcLspReady(page);
  });

  await test.step('open each generated .d.ts and assert first-line module declarations', async () => {
    await assertLwcSfdxTypingsGenerated(page);
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
