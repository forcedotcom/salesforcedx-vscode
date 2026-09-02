/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the LWC custom-components index (ADR 0022). The web twin
 * (lwcCustomComponentsIndex.headless.spec.ts) proves the LWC language server updates
 * `.sfdx/indexes/lwc/custom-components.json` when a new bundle is created against a plain Page; this
 * proves the same happens inside the Code Builder image, where the LWC extension and its language
 * server run in the Node host alongside the full installed extension set. Pure local indexing — no
 * org needed — so it is a deterministic signal that the LSP incrementally re-indexes in the container.
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { createLwc, openLwcFile, openSfdxCustomComponentsJson, waitForLwcLspReady } from '../../utils/lwcUtils';

test('New LWC bundle updates .sfdx/indexes/lwc/custom-components.json without reloading VS Code (Code Builder)', async ({
  page
}) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique per-run name: the container drives a single sequential workbench, so a fixed name would
  // collide with a bundle another spec (or an earlier run) already created.
  const bundleCamel = `idxCmp${Date.now()}`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'lwcIndex.container.01-ready.png');
  });

  await test.step('create a bundle and wait for LWC language server indexing', async () => {
    await createLwc(page, bundleCamel);
    await openLwcFile(page, `${bundleCamel}.js`);
    await waitForLwcLspReady(page);
    await saveScreenshot(page, 'lwcIndex.container.02-indexed.png');
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
    await saveScreenshot(page, 'lwcIndex.container.03-index-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
