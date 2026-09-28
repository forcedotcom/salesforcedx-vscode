/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for LWC LSP Go to Definition from a JS import to the generated engine.d.ts (ADR 0022).
 * The web twin (lwcLspGoToDefinitionJs.headless.spec.ts) is skipped on VS Code for Web because the TS/JS
 * language service on a virtual filesystem resolves typings unreliably. The Code Builder container runs
 * the *desktop* LWC language server (the Page is browser-flavored, so isDesktop() is false, but behavior
 * matches desktop), so this navigation is expected to work and runs unconditionally here. Pure local
 * editing — no org needed.
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  EDITOR,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  TAB,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { createLwc, openLwcFile, waitForLwcLspReady } from '../../utils/lwcUtils';

test('LWC LSP Go to Definition navigates from JS import to engine.d.ts LWC module declaration (Code Builder)', async ({
  page
}) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Shared persistent workbench: unique suffix prevents collisions across specs/re-runs.
  const componentName = `gtdJsComp${Date.now()}`;
  const htmlFile = `${componentName}.html`;
  const jsFile = `${componentName}.js`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'lwcGotoDefJs.container.01-ready.png');
  });

  await test.step('create Lightning Web Component', async () => {
    await createLwc(page, componentName);
  });

  await test.step('wait for LWC LSP to finish indexing', async () => {
    // Open the HTML file first so the status item appears, then switch back to JS
    await openLwcFile(page, htmlFile);
    await waitForLwcLspReady(page);
    await openLwcFile(page, jsFile);
  });

  await test.step('cmd+click LightningElement in the import binding to navigate to its declaration', async () => {
    // Default SFDX template line 1: `import { LightningElement } from 'lwc';`
    // Hover first so TypeScript computes the token's type info before cmd+clicking (mirrors manual test workflow).
    // Use `.first()` to select the import binding, not the extends clause occurrence.
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${jsFile}"]`);
    await editor.waitFor({ state: 'visible', timeout: 10_000 });
    const lightningToken = editor
      .locator('.view-lines span')
      .filter({ hasText: /^LightningElement$/ })
      .first();
    await lightningToken.waitFor({ state: 'visible', timeout: 10_000 });
    // Hover to trigger TypeScript type resolution; wait for the hover card to show `LightningElement`
    // before cmd+clicking — ensures TS has computed the declaration before Go to Definition fires.
    // In parallel test runs the TS language service can be slow; the hover wait is the synchronisation point.
    await lightningToken.hover();
    await expect(
      page.locator('.monaco-hover').filter({ hasText: /LightningElement/ }),
      'hover tooltip should show LightningElement type info before cmd+click'
    ).toBeVisible({ timeout: 20_000 });
    await lightningToken.click({ modifiers: ['ControlOrMeta'] });
  });

  await test.step('verify navigation opened the engine.d.ts LWC module declaration', async () => {
    // Resolution target is the LWC LSP-generated engine.d.ts under .sfdx/typings/lwc/.
    // URIs vary by host (file:, vscode-file:, virtual); TS may use Peek instead of a new tab.
    const byUri = page
      .locator(`${EDITOR_WITH_URI}[data-uri*="engine.d.ts"]`)
      .or(page.locator(`${EDITOR_WITH_URI}[data-uri*="types.d.ts"]`))
      .or(page.locator(`${EDITOR_WITH_URI}[data-uri*="typings"]`))
      .or(page.locator(TAB).filter({ hasText: /engine\.d\.ts|types\.d\.ts/i }));
    const byDeclaration = page
      .locator(EDITOR_WITH_URI)
      .filter({ hasText: /export class LightningElement\b|declare module ['"]lwc['"]/ });
    const peekDeclaration = page
      .locator('.peekview-widget')
      .locator(EDITOR)
      .filter({ hasText: /export class LightningElement\b|declare module ['"]lwc['"]/ });
    await expect(
      byUri.or(byDeclaration).or(peekDeclaration).first(),
      'Go to Definition should open engine.d.ts LWC module declaration'
    ).toBeVisible({
      timeout: 30_000
    });
    await saveScreenshot(page, 'lwcGotoDefJs.container.02-navigated.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
