/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for LWC LSP Go to Definition from an HTML property binding (ADR 0022). The web twin
 * (lwcLspGoToDefinitionHtml.headless.spec.ts) proves navigation works against a plain Page; this proves the
 * same jump comes from the LWC language server running inside the Code Builder image, where the LWC
 * extension runs in the Node host alongside the full installed extension set. Pure local editing — no
 * org needed — so it is a deterministic signal that the LSP activated and indexed in the container.
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  goToDefinition,
  goToLineCol,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  TAB,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { createLwc, openLwcFile, waitForLwcLspReady } from '../../utils/lwcUtils';
import { disableDeployOnSaveWeb } from '../../utils/lwcWebScratchAuth';

test('LWC LSP Go to Definition navigates from HTML property binding to JS class property (Code Builder)', async ({
  page
}) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Shared persistent workbench: unique suffix prevents collisions across specs/re-runs.
  // The `gtdHtmlComp` prefix triggers the greeting/{greeting} template seed in createLwc.
  const componentName = `gtdHtmlComp${Date.now()}`;
  const htmlFile = `${componentName}.html`;
  const jsFile = `${componentName}.js`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await disableDeployOnSaveWeb(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'lwcGotoDefHtml.container.01-ready.png');
  });

  await test.step('create component via SFDX and open HTML (template patched after create)', async () => {
    await createLwc(page, componentName);
    await openLwcFile(page, htmlFile);
  });

  await test.step('wait for LWC LSP to finish indexing', async () => {
    await waitForLwcLspReady(page);
  });

  await test.step('position cursor on the {greeting} binding in the HTML template', async () => {
    // Patched HTML line 2: "    <p>{greeting}</p>" — place cursor on "greeting"
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${htmlFile}"]`);
    await editor.click();
    await goToLineCol(page, 2, 10);
  });

  await test.step('execute Go to Definition', async () => {
    await goToDefinition(page);
  });

  await test.step('verify navigation targets the JS class field location', async () => {
    // Prefer a visible editor for the JS module; tab label is a fallback if the URI attribute differs (e.g. peek).
    const jsEditor = page.locator(`${EDITOR_WITH_URI}[data-uri*="${jsFile}"]`);
    const jsTab = page.locator(TAB).filter({ hasText: new RegExp(`${componentName}\\.js`) });
    await expect(
      jsEditor.or(jsTab).first(),
      'Go to Definition should open the JS class member for the binding'
    ).toBeVisible({
      timeout: 15_000
    });
    await saveScreenshot(page, 'lwcGotoDefHtml.container.02-navigated.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
