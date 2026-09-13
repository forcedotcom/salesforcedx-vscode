/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for LWC LSP indexing (ADR 0022). The web twin (lwcLspIndexing.headless.spec.ts) proves
 * indexing reaches "Indexing complete" against a plain Page; this proves the LWC language server activates
 * and finishes indexing inside the Code Builder image, where the LWC extension runs in the Node host
 * alongside the full installed extension set. Pure local generation — no org needed — so it is a fast,
 * deterministic signal that the LSP came up in the container.
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
import { createLwc, openLwcFile, waitForLwcLspReady } from '../../utils/lwcUtils';

test('LWC LSP finishes indexing and shows status in status bar (Code Builder)', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Shared persistent workbench: unique suffix prevents collisions across specs/re-runs.
  const componentName = `indexComp${Date.now()}`;
  const htmlFile = `${componentName}.html`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'lwcIndexing.container.01-ready.png');
  });

  await test.step('create Lightning Web Component', async () => {
    await createLwc(page, componentName);
  });

  await test.step('open LWC HTML file to activate language status item', async () => {
    // The language status item (lwcLanguageServerStatus) only appears for LWC html/js/ts files
    await openLwcFile(page, htmlFile);
  });

  await test.step('wait for LWC LSP to finish indexing', async () => {
    await waitForLwcLspReady(page);
    await saveScreenshot(page, 'lwcIndexing.container.02-indexed.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
