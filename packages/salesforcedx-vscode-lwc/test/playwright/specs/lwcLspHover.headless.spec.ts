/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Desktop is the primary target for these hover tests.
 * The JS hover test is skipped on web — TypeScript hover for LWC JS imports is not stable on VS Code for Web E2E
 * (same issue as lwcLspGoToDefinitionJs: cross-file TS on web / memfs handling).
 * The HTML hover test runs on both desktop and web since the LWC LSP handles it directly.
 *
 * Code Builder container: the Page is browser-flavored (`isDesktop()` is false), but the container runs the
 * *desktop* LWC language server, so BOTH the HTML and JS hover tests run unconditionally there — the JS
 * hover skip below is also exempted for the container.
 */
import { expect } from '@playwright/test';
import {
  EDITOR_WITH_URI,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  goToLineCol,
  isDesktop,
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

test('LWC LSP provides hover documentation for lightning-accordion in HTML templates', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique per-run name: the container drives a single sequential workbench, so a fixed name would
  // collide with a bundle another spec (or an earlier run) already created.
  const componentName = isContainer ? `hoverHtmlComp${Date.now()}` : 'hoverHtmlComp';
  const htmlFile = `${componentName}.html`;

  await test.step('create Lightning Web Component', async () => {
    await createLwc(page, componentName);
  });

  await test.step('open HTML file and wait for LWC LSP to finish indexing', async () => {
    await openLwcFile(page, htmlFile);
    await waitForLwcLspReady(page);
  });

  await test.step('insert a lightning-accordion element into the template', async () => {
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${htmlFile}"]`);
    await editor.click();
    // Default template: line 1 "<template>", line 2 "</template>"
    await goToLineCol(page, 1, 11); // end of "<template>"
    await page.keyboard.press('Enter');
    await page.keyboard.type('<lightning-accordion></lightning-accordion>');
  });

  await test.step('hover over lightning-accordion tag and verify the LWC LSP hover card appears', async () => {
    // Re-position to line 2 col 2 so the cursor is on the tag name, not the '<' bracket.
    await goToLineCol(page, 2, 2);
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${htmlFile}"]`);
    // Find the tag-name token rendered by Monaco for "lightning-accordion"
    const tagToken = editor
      .locator('.view-lines span')
      .filter({ hasText: /^lightning-accordion$/ })
      .first();
    await tagToken.waitFor({ state: 'visible', timeout: 10_000 });
    // Cold-LSP race: the index-status item can show before doHover is ready, so a single hover
    // that lands before the provider responds never re-triggers. Poll: each attempt clears any
    // open hover and moves the pointer off the token so the next hover() is a genuine pointer
    // transition that re-drives the provider, then asserts the card appears.
    // "View in Component Library" appears in every lightning-* component hover.
    await expect(async () => {
      await page.keyboard.press('Escape');
      // Move the pointer off the token to an editor-body coordinate so the next hover() is a
      // genuine pointer transition (avoids targeting the workbench title bar at 0,0).
      const editorBox = await editor.boundingBox();
      await page.mouse.move((editorBox?.x ?? 0) + 10, (editorBox?.y ?? 0) + (editorBox?.height ?? 0) - 10);
      await tagToken.hover();
      await expect(
        page.locator('.monaco-hover').filter({ hasText: /View in Component Library/i }),
        'LWC LSP hover card should appear with lightning-accordion component documentation'
      ).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 45_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('LWC LSP provides hover type information for LightningElement in JS files', async ({ page }) => {
  test.skip(
    !isContainer && !isDesktop(),
    'Desktop only — TypeScript hover for LWC JS imports is not stable on VS Code for Web E2E (container is exempt: it runs the desktop LWC language server)'
  );
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique per-run name: the container drives a single sequential workbench, so a fixed name would
  // collide with a bundle another spec (or an earlier run) already created.
  const componentName = isContainer ? `hoverJsComp${Date.now()}` : 'hoverJsComp';
  const htmlFile = `${componentName}.html`;
  const jsFile = `${componentName}.js`;

  await test.step('create Lightning Web Component', async () => {
    await createLwc(page, componentName);
  });

  await test.step('open HTML file and wait for LWC LSP to finish indexing, then switch to JS', async () => {
    // Open HTML first so the LWC language status item appears, then switch back to JS.
    await openLwcFile(page, htmlFile);
    await waitForLwcLspReady(page);
    await openLwcFile(page, jsFile);
  });

  await test.step('hover over LightningElement in the import statement and verify hover card', async () => {
    // Default SFDX template line 1: `import { LightningElement } from 'lwc';`
    // TypeScript language service resolves LightningElement from .sfdx/typings/lwc/engine.d.ts
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${jsFile}"]`);
    await editor.waitFor({ state: 'visible', timeout: 10_000 });
    const lightningToken = editor
      .locator('.view-lines span')
      .filter({ hasText: /^LightningElement$/ })
      .first();
    await lightningToken.waitFor({ state: 'visible', timeout: 10_000 });
    // Same cold-LSP race as the HTML hover: poll re-hover so a hover that lands before the TS
    // language service is ready gets re-driven.
    await expect(async () => {
      await page.keyboard.press('Escape');
      // Move the pointer off the token to an editor-body coordinate so the next hover() is a
      // genuine pointer transition (avoids targeting the workbench title bar at 0,0).
      const editorBox = await editor.boundingBox();
      await page.mouse.move((editorBox?.x ?? 0) + 10, (editorBox?.y ?? 0) + (editorBox?.height ?? 0) - 10);
      await lightningToken.hover();
      await expect(
        page.locator('.monaco-hover').filter({ hasText: /LightningElement/ }),
        'hover card should show LightningElement type information from the LWC engine typings'
      ).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 45_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
