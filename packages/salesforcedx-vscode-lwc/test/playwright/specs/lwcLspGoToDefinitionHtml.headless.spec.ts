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
  goToDefinition,
  goToLineCol,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  TAB,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { isContainer, sharedTest as test } from '../fixtures';
import { createLwc, openLwcFile, waitForLwcLspReady } from '../utils/lwcUtils';
import { disableDeployOnSaveWeb } from '../utils/lwcWebScratchAuth';

test.beforeEach(async ({ page }) => {
  // The containerTest fixture already awaited workbench readiness before handing over `page`.
  if (!isContainer) {
    await waitForVSCodeWorkbench(page);
  }
  await closeWelcomeTabs(page);
  await disableDeployOnSaveWeb(page);
  await ensureSecondarySideBarHidden(page);
});

test('LWC LSP Go to Definition navigates from HTML property binding to JS class property', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique per-run name: the container drives a single sequential workbench, so a fixed name would
  // collide with a bundle another spec (or an earlier run) already created.
  // The `gtdHtmlComp` prefix triggers the greeting/{greeting} template seed in createLwc.
  const componentName = isContainer ? `gtdHtmlComp${Date.now()}` : 'gtdHtmlComp';
  const htmlFile = `${componentName}.html`;
  const jsFile = `${componentName}.js`;

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
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
