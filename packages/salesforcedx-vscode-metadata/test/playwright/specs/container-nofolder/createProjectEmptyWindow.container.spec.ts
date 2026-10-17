/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for "SFDX: Create Project" from an empty window (no folder open) —
 * createProjectEmptyWindow.desktop.spec.ts. Lives in container-nofolder (not container-noproject)
 * because the precondition is "no folder open at all", which is exactly the shape the orchestrator
 * seeds for the test:container:nofolder phase (empty coder.json query, no `folder` key) — see
 * emptyWorkspaceSfdxCommands.container.spec.ts in this same directory, which already proves the
 * Create Project commands are contributed with no folder open.
 *
 * The file dialog that follows browses the container's filesystem regardless of what workspace is
 * (or isn't) open, so it can still target the no-project mount's checked-in scratch/ subfolder —
 * same target as createProject.container.spec.ts, just reached from a folder-less starting point.
 * Standalone for the same reason as that spec: no workspaceDir fixture on containerTest, and a hard
 * constraint (the scratch target lives on a DIFFERENT mount than this phase's seeded shape) rules out
 * sharing a body with the desktop twin.
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

const PROJECT_NAME = `TestProjectEmptyWindowContainer${Date.now()}`;

const containerName = process.env.CB_CONTAINER_NAME;
const noProjectContainerDir = process.env.CB_NOPROJECT_CONTAINER_DIR;
const noProjectHostDir = process.env.CB_NOPROJECT_HOST_DIR;
const scratchContainerDir = noProjectContainerDir ? path.posix.join(noProjectContainerDir, 'scratch') : undefined;
const scratchHostDir = noProjectHostDir ? path.join(noProjectHostDir, 'scratch') : undefined;

test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
});

test.afterEach(async () => {
  if (containerName && scratchContainerDir) {
    removePathsInContainer(containerName, [path.posix.join(scratchContainerDir, PROJECT_NAME)]);
  }
});

test('Create Project (Code Builder): standard project from empty window (no folder open)', async ({ page }) => {
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

  await test.step('workbench ready (no folder open)', async () => {
    // The containerTest fixture already awaited workbench readiness; the test:container:nofolder
    // phase's seeded coder.json already has no `folder` key, so there is nothing to close here —
    // unlike the desktop twin's prepareNoFolderOpenForPaletteTests, which closes an OPEN folder.
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
    await saveScreenshot(page, 'createProjectEmptyWindow.container.02-standard-selected.png');
  });

  await test.step('enter project name', async () => {
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.type(PROJECT_NAME);
    await saveScreenshot(page, 'createProjectEmptyWindow.container.03-name-entered.png');
    await page.keyboard.press('Enter');
  });

  await test.step('select folder in simple dialog', async () => {
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'createProjectEmptyWindow.container.04-folder-dialog.png');

    const input = quickInput.locator('input.input');
    const targetPath = `${scratchContainerDir}/`;
    await input.fill(targetPath);

    await expect(quickInput.getByText('path does not exist')).not.toBeVisible({ timeout: 5000 });
    await expect(input).toHaveValue(new RegExp(`${scratchContainerDir.replaceAll('.', '\\.')}/$`), { timeout: 5000 });
    await saveScreenshot(page, 'createProjectEmptyWindow.container.05-folder-path-set.png');

    const createButton = quickInput.getByRole('button', { name: 'Create Project' });
    await createButton.click();
  });

  await test.step('verify project files on disk', async () => {
    const projectDir = path.join(scratchHostDir, PROJECT_NAME);

    await expect(async () => {
      await fs.access(path.join(projectDir, 'sfdx-project.json'));
    }).toPass({ timeout: 120_000 });

    await fs.access(path.join(projectDir, 'force-app'));
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
