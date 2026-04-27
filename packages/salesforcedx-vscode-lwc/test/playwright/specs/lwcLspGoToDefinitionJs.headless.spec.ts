/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Web (`npm run test:web`): the spec below is skipped. VS Code for Web runs the TS/JS language service on a virtual
 * filesystem (e.g. memfs); project-wide analysis is often "partial" until fully loaded, and path resolution differs
 * from desktop `file://`. Navigating from LWC `.js` to extension typings (`engine.d.ts`) via Go to Type Definition is
 * unreliable in headless web E2E even though typings exist in both hosts. Desktop matches typical local DX; see
 * https://github.com/microsoft/vscode/pull/169311 (cross-file TS on web) and memfs handling in
 * `salesforcedx-lwc-language-server` `componentIndexer`.
 */
import { expect } from '@playwright/test';
import {
  EDITOR,
  EDITOR_WITH_URI,
  TAB,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  isDesktop,
  setupConsoleMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import { createLwc, openLwcFile, waitForLwcLspReady } from '../utils/lwcUtils';

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
});

test('LWC LSP Go to Definition navigates from JS import to engine.d.ts LWC module declaration', async ({ page }) => {
  test.skip(!isDesktop(), 'Desktop only — see file comment: web TS/navigation to typings is not stable for this E2E');

  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create Lightning Web Component', async () => {
    await createLwc(page, 'gtdJsComp');
  });

  await test.step('wait for LWC LSP to finish indexing', async () => {
    // Open the HTML file first so the status item appears, then switch back to JS
    await openLwcFile(page, 'gtdJsComp.html');
    await waitForLwcLspReady(page);
    await openLwcFile(page, 'gtdJsComp.js');
  });

  await test.step('cmd+click LightningElement in the import binding to navigate to its declaration', async () => {
    // Default SFDX template line 1: `import { LightningElement } from 'lwc';`
    // Hover first so TypeScript computes the token's type info before cmd+clicking (mirrors manual test workflow).
    // Use `.first()` to select the import binding, not the extends clause occurrence.
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="gtdJsComp.js"]`);
    await editor.waitFor({ state: 'visible', timeout: 10_000 });
    const lightningToken = editor.locator('.view-lines span').filter({ hasText: /^LightningElement$/ }).first();
    await lightningToken.waitFor({ state: 'visible', timeout: 10_000 });
    // Hover to trigger TypeScript type resolution; wait for the hover card to show `LightningElement`
    // before cmd+clicking — ensures TS has computed the declaration before Go to Definition fires.
    // In parallel test runs the TS language service can be slow; the hover wait is the synchronisation point.
    await lightningToken.hover();
    await expect(
      page.locator('.monaco-hover').filter({ hasText: /LightningElement/ }),
      'hover tooltip should show LightningElement type info before cmd+click'
    ).toBeVisible({ timeout: 20_000 });
    await lightningToken.click({ modifiers: ['Meta'] });
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
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
