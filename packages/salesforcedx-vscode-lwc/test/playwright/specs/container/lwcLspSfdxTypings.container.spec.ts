/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the LWC language server SFDX typings generation (ADR 0022). The web twin
 * (lwcLspSfdxTypings.headless.spec.ts) proves the LSP copies its `.d.ts` typings into the workspace
 * against a plain Page; this proves the same happens inside the Code Builder image, where the LWC
 * extension and its language server run in the Node host alongside the full installed extension set.
 * Pure local indexing — no org needed — so it is a deterministic signal that the LSP activated and
 * indexed the workspace in the container.
 */

import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { assertLwcSfdxTypingsGenerated, createLwc, openLwcFile, waitForLwcLspReady } from '../../utils/lwcUtils';

test('LWC LSP writes SFDX typings under .sfdx/typings/lwc with expected module headers (Code Builder)', async ({
  page
}) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique per-run name: the container drives a single sequential workbench, so a fixed name would
  // collide with a bundle another spec (or an earlier run) already created.
  const componentName = `typingsProbe${Date.now()}`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'lwcTypings.container.01-ready.png');
  });

  await test.step('create bundle and wait for LSP indexing (triggers typings copy into workspace)', async () => {
    await createLwc(page, componentName);
    await openLwcFile(page, `${componentName}.js`);
    await waitForLwcLspReady(page);
    await saveScreenshot(page, 'lwcTypings.container.02-indexed.png');
  });

  await test.step('open each generated .d.ts and assert first-line module declarations', async () => {
    await assertLwcSfdxTypingsGenerated(page);
    await saveScreenshot(page, 'lwcTypings.container.03-typings-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
