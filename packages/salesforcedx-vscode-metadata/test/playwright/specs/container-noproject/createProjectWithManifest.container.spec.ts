/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for "SFDX: Create Project with Manifest" (createProjectWithManifest.desktop.spec.ts).
 * See createProject.container.spec.ts (same directory) for the full rationale on why this is
 * standalone and targets the no-project fixture's checked-in scratch/ subfolder rather than a sibling
 * of workspaceDir. This spec differs only in the command/NLS key and the extra manifest/package.xml
 * assertion.
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

const PROJECT_NAME = `TestManifestProjectContainer${Date.now()}`;

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

test('Create Project With Manifest (Code Builder): standard project via command palette', async ({ page }) => {
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
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('verify Create Project with Manifest command available', async () => {
    await verifyCommandExists(page, packageNls.project_generate_with_manifest_text, 60_000);
  });

  await test.step('run Create Project with Manifest, select Standard template', async () => {
    await executeCommandWithCommandPalette(page, packageNls.project_generate_with_manifest_text);
    await selectQuickInputOption(page, /Standard/, {
      quickInputVisibleTimeout: 30_000,
      optionVisibleTimeout: 15_000,
      retryTimeout: 60_000,
      timeout: 20_000
    });
    await saveScreenshot(page, 'createProjectWithManifest.container.02-standard-selected.png');
  });

  await test.step('enter project name', async () => {
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.type(PROJECT_NAME);
    await saveScreenshot(page, 'createProjectWithManifest.container.03-name-entered.png');
    await page.keyboard.press('Enter');
  });

  await test.step('select folder in simple dialog', async () => {
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'createProjectWithManifest.container.04-folder-dialog.png');

    const input = quickInput.locator('input.input');
    const targetPath = `${scratchContainerDir}/`;
    await input.fill(targetPath);

    await expect(quickInput.getByText('path does not exist')).not.toBeVisible({ timeout: 5000 });
    await expect(input).toHaveValue(new RegExp(`${scratchContainerDir.replaceAll('.', '\\.')}/$`), { timeout: 5000 });
    await saveScreenshot(page, 'createProjectWithManifest.container.05-folder-path-set.png');

    const createButton = quickInput.getByRole('button', { name: 'Create Project' });
    await createButton.click();
  });

  await test.step('verify project files on disk', async () => {
    const projectDir = path.join(scratchHostDir, PROJECT_NAME);

    await expect(async () => {
      await fs.access(path.join(projectDir, 'sfdx-project.json'));
      await fs.access(path.join(projectDir, 'force-app'));
      await fs.access(path.join(projectDir, 'manifest', 'package.xml'));
    }).toPass({ timeout: 120_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
