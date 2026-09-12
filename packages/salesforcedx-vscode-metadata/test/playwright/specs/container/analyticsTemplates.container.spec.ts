/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the Analytics (wave) sample-template scaffold. The headless twin
 * (analyticsTemplates.headless.spec.ts) proves "SFDX: Create Sample Analytics Template" scaffolds the
 * seven template files from both the command palette and the waveTemplates folder context menu. This
 * proves the same fully-local TemplateService.create scaffold runs inside the Code Builder image —
 * there is no org round-trip, so it uses the ambient boot org shape without any org setup.
 *
 * Uses unique Date.now() names so the shared, persistent workbench never collides across runs, and
 * removes each created template directory from the bind-mounted fixture in afterEach (via
 * CB_FIXTURE_HOST_DIR, the host side of the mount) so the workspace shape is left as found.
 */

import { expect, type Page } from '@playwright/test';
import {
  activeQuickInputWidget,
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  EDITOR,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  executeExplorerContextMenuCommand,
  focusOnFilesExplorer,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

const expectedFiles = [
  'app-to-template-rules.json',
  'folder.json',
  'releaseNotes.html',
  'template-info.json',
  'template-to-app-rules.json',
  'ui.json',
  'variables.json'
] as const;

/*
 * The host side of the bind mount, published by the orchestrator (scripts/codeBuilderLocalE2E.ts). A
 * host-side node:fs remove here deletes the template the in-container scaffold wrote through the
 * mount. Resolved once at load; a missing var is a wiring bug (the orchestrator always sets it), so
 * fail loud rather than remove from a guessed path.
 */
const fixtureHostDir = process.env.CB_FIXTURE_HOST_DIR;

// Templates are scaffolded under the default package's waveTemplates folder (see
// analyticsGenerateTemplate.ts). Track the created template dirs so afterEach can remove them.
const createdTemplateDirs: string[] = [];

const enterTemplateName = async (page: Page, name: string): Promise<void> => {
  const quickInput = activeQuickInputWidget(page);
  await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
  await page.keyboard.type(name);
  await page.keyboard.press('Enter');
};

const verifyGeneratedTemplate = async (page: Page, name: string): Promise<void> => {
  const editor = page.locator(`${EDITOR}[data-uri*="${name}/template-info.json"]`).first();
  await editor.waitFor({ state: 'visible', timeout: 30_000 });
  await expect(editor.getByText(`"name": "${name}"`), 'template-info.json should include template name').toBeVisible({
    timeout: 10_000
  });

  await focusOnFilesExplorer(page);
  await Promise.all(
    expectedFiles.map(file =>
      expect(
        page
          .locator('[role="treeitem"]')
          .filter({ hasText: new RegExp(`${file}$`, 'i') })
          .first(),
        `${file} should be visible in explorer`
      ).toBeVisible({ timeout: 15_000 })
    )
  );
};

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test.afterEach(async () => {
  // Remove any template dirs this spec scaffolded so the shared fixture is left as found.
  await Promise.all(createdTemplateDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

test('Analytics Templates (Code Builder): creates sample template via command palette and explorer context menu', async ({
  page
}) => {
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  if (!fixtureHostDir) {
    throw new Error(
      'CB_FIXTURE_HOST_DIR is not set — the orchestrator (scripts/codeBuilderLocalE2E.ts) must publish the ' +
        'host side of the fixture bind mount so this spec can clean up scaffolded templates.'
    );
  }
  const waveTemplatesHostDir = path.join(fixtureHostDir, 'force-app', 'main', 'default', 'waveTemplates');

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'analyticsTemplates.container.01-ready.png');
  });

  await test.step('create analytics template via command palette', async () => {
    const name = `AnalyticsPalette${Date.now()}`;
    createdTemplateDirs.push(path.join(waveTemplatesHostDir, name));
    await verifyCommandExists(page, packageNls.analytics_generate_template_text, 30_000);
    await executeCommandWithCommandPalette(page, packageNls.analytics_generate_template_text);
    await enterTemplateName(page, name);
    // Accept the default output dir (the default package's waveTemplates folder, offered first).
    await waitForQuickInputFirstOption(page);
    await page.keyboard.press('Enter');
    await verifyGeneratedTemplate(page, name);
    await saveScreenshot(page, `analyticsTemplates.container.02-palette-${name}.png`);
  });

  await test.step('create analytics template via explorer context menu', async () => {
    const name = `AnalyticsExplorer${Date.now()}`;
    createdTemplateDirs.push(path.join(waveTemplatesHostDir, name));
    await closeAllEditors(page);
    // The command-palette step above scaffolded into waveTemplates, so the folder is now in the tree;
    // right-clicking it passes the folder as the output dir (no output-dir prompt on this path).
    await executeExplorerContextMenuCommand(page, /^waveTemplates\b/, packageNls.analytics_generate_template_text);
    await enterTemplateName(page, name);
    await verifyGeneratedTemplate(page, name);
    await saveScreenshot(page, `analyticsTemplates.container.03-explorer-${name}.png`);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
