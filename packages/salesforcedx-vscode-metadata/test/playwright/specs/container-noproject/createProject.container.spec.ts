/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for "SFDX: Create Project" (createProject.desktop.spec.ts). The desktop twin opens
 * a non-project workspace, runs the command, picks a sibling-of-workspaceDir folder via the simple
 * file dialog, and verifies the scaffolded project on disk via host node:fs. `containerTest` has no
 * `workspaceDir` fixture (there's no host-side notion of "the opened folder" for a browser-driven
 * container session) and the opened folder's PARENT isn't bind-mounted anyway, so this targets a
 * dedicated, already-mounted, writable location instead: the no-project fixture's checked-in
 * `scratch/` subfolder (see that fixture's README). Standalone (not merged into the desktop spec) for
 * that reason — this is the "hard constraint rules out sharing a body" case the parity doc's "Adding a
 * container suite" section calls out.
 *
 * Runs in the test:container:noproject phase: the orchestrator has already re-seeded coder.json to
 * this mount + restarted before this suite runs, and every test's `page` fixture independently
 * navigates to `/` (which 302-redirects to that seeded folder) before the test body starts — so this
 * spec's own `vscode.openFolder` navigation at the end never leaks into a later test.
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  removePathsInContainer,
  resetContainerWorkbench,
  saveScreenshot,
  selectQuickInputOption,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

const PROJECT_NAME = `TestProjectContainer${Date.now()}`;

/*
 * Container name + the CONTAINER/HOST split for the no-project mount, published by the orchestrator
 * (scripts/codeBuilderLocalE2E.ts). The picker needs the CONTAINER path (what code-server's file
 * dialog browses); the verify step needs the HOST path (where this Node process's fs.access runs).
 * Resolved once at load; a missing var is a wiring bug, so fail loud in the test body rather than
 * silently probing a guessed path.
 */
const containerName = process.env.CB_CONTAINER_NAME;
const noProjectContainerDir = process.env.CB_NOPROJECT_CONTAINER_DIR;
const noProjectHostDir = process.env.CB_NOPROJECT_HOST_DIR;
const scratchContainerDir = noProjectContainerDir ? path.posix.join(noProjectContainerDir, 'scratch') : undefined;
const scratchHostDir = noProjectHostDir ? path.join(noProjectHostDir, 'scratch') : undefined;

test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
});

test.afterEach(async () => {
  // The scaffolded project is owned by the container's codebuilder user (TemplateService.create ran
  // INSIDE the container's Node host) — a host-side remove would fail with EACCES. rm -rf is
  // idempotent, so this is a harmless no-op if the test failed before scaffolding anything.
  if (containerName && scratchContainerDir) {
    removePathsInContainer(containerName, [path.posix.join(scratchContainerDir, PROJECT_NAME)]);
  }
});

test('Create Project (Code Builder): standard project via command palette', async ({ page }) => {
  test.setTimeout(120_000);

  if (!containerName || !scratchContainerDir || !scratchHostDir) {
    throw new Error(
      'CB_CONTAINER_NAME / CB_NOPROJECT_CONTAINER_DIR / CB_NOPROJECT_HOST_DIR is not set — the ' +
        'orchestrator (scripts/codeBuilderLocalE2E.ts) must publish these so this spec can target the ' +
        "no-project mount's scratch/ subfolder and clean up what it scaffolds there."
    );
  }

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready (no project open)', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('verify Create Project command available', async () => {
    await verifyCommandExists(page, packageNls.project_generate_text, 60_000);
  });

  await test.step('run Create Project, select Standard template', async () => {
    await executeCommandWithCommandPalette(page, packageNls.project_generate_text);
    await selectQuickInputOption(page, /Standard/, {
      quickInputVisibleTimeout: 30_000,
      optionVisibleTimeout: 15_000,
      retryTimeout: 60_000,
      timeout: 20_000
    });
    await saveScreenshot(page, 'createProject.container.02-standard-selected.png');
  });

  await test.step('enter project name', async () => {
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.type(PROJECT_NAME);
    await saveScreenshot(page, 'createProject.container.03-name-entered.png');
    await page.keyboard.press('Enter');
  });

  await test.step('select folder in simple dialog', async () => {
    // code-server has no native OS dialog to replace — showOpenDialog always renders this same
    // quick-input-style simple file dialog in the browser, so the desktop spec's dialog-driving code
    // applies as-is; only the target path (a posix container path, not workspaceDir's parent) differs.
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'createProject.container.04-folder-dialog.png');

    const input = quickInput.locator('input.input');
    const targetPath = `${scratchContainerDir}/`;
    await input.fill(targetPath);

    await expect(quickInput.getByText('path does not exist')).not.toBeVisible({ timeout: 5000 });
    await expect(input).toHaveValue(new RegExp(`${scratchContainerDir.replaceAll('.', '\\.')}/$`), { timeout: 5000 });
    await saveScreenshot(page, 'createProject.container.05-folder-path-set.png');

    const createButton = quickInput.getByRole('button', { name: 'Create Project' });
    await createButton.click();
  });

  await test.step('verify project files on disk', async () => {
    const projectDir = path.join(scratchHostDir, PROJECT_NAME);

    // Poll via HOST node:fs — this does not depend on the page surviving the extension's trailing
    // vscode.openFolder navigation (code-server answers that with a real browser navigation; the next
    // test's own page.goto('/') lands back on the seeded no-project folder regardless of where this
    // test's page ends up).
    await expect(async () => {
      await fs.access(path.join(projectDir, 'sfdx-project.json'));
    }).toPass({ timeout: 120_000 });

    await fs.access(path.join(projectDir, 'force-app'));
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
