/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  clearOutputChannel,
  closeWelcomeTabs,
  createMinimalOrg,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  selectOutputChannel,
  upsertScratchOrgAuthFieldsToSettings,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const PUSH_COMMAND = 'SFDX: Push Source to Default Org and Ignore Conflicts';
const PUSH_TIMEOUT_MS = 600_000;

/** Shared workbench bootstrap: connect MINIMAL_ORG_ALIAS auth and close any leftover tabs. */
export const setupWorkbenchAndAuth = async (page: Page): Promise<void> => {
  const createResult = await createMinimalOrg();
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await upsertScratchOrgAuthFieldsToSettings(page, createResult);
};

/** Wait for A4V (installed by fixture) to be active so OAS commands appear. */
export const waitForA4VAndOasCommands = async (page: Page): Promise<void> => {
  // Both commands are gated by `salesforcedx-einstein-gpt.isEnabled`; their presence proves A4V is loaded.
  await verifyCommandExists(page, 'SFDX: Create OpenAPI Document from This Class', 60_000);
};

/** Push current workspace source to the connected scratch org. Asserts on the Salesforce Metadata
 * output channel (more reliable than the success toast, which can be replaced by progress dialog). */
export const pushSource = async (page: Page): Promise<void> => {
  await verifyCommandExists(page, PUSH_COMMAND, 60_000);
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, 'Salesforce Metadata');
  await clearOutputChannel(page);
  await executeCommandWithCommandPalette(page, PUSH_COMMAND);
  await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: PUSH_TIMEOUT_MS });
};

/** Overwrite an existing on-disk file in the workspace. */
export const writeWorkspaceFile = async (
  workspaceDir: string,
  relativePath: string,
  contents: string
): Promise<void> => {
  const target = path.join(workspaceDir, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents);
};

/** Bump the workspace sfdx-project.json sourceApiVersion to 66.0 so OAS-generated ESR files
 * (which include `registrationProviderAsset`, only valid at API >=66.0) deploy successfully.
 * The shared fixture template defaults to 64.0. */
export const setWorkspaceApiVersion = async (workspaceDir: string, version = '66.0'): Promise<void> => {
  const file = path.join(workspaceDir, 'sfdx-project.json');
  const project = JSON.parse(await fs.readFile(file, 'utf8'));
  project.sourceApiVersion = version;
  await fs.writeFile(file, JSON.stringify(project, null, 2));
};

/** Click a modal-dialog button by its label (e.g., 'Overwrite', 'Manually merge with existing ESR').
 * Short timeout — most dialogs only appear when an ESR already exists; callers wrap with .catch
 * to skip when absent without burning the success-notification window. */
export const clickModalDialogButton = async (page: Page, label: string, timeout = 5000): Promise<void> => {
  const dialogButton = page
    .locator('.monaco-dialog-box, .dialog-shadow')
    .getByRole('button', { name: label, exact: true })
    .first();
  await expect(dialogButton).toBeVisible({ timeout });
  await dialogButton.click();
};

/**
 * Confirms the "Select folder to store OpenAPI Document" InputBox by pressing Enter
 * to accept the prefilled default ESR path. Must be called immediately after invoking
 * the OAS create command (palette or context menu).
 */
export const confirmEsrFolderPrompt = async (page: Page): Promise<void> => {
  const folderPrompt = page
    .locator(QUICK_INPUT_WIDGET)
    .filter({ hasText: 'Select folder to store OpenAPI Document' })
    .first();
  await expect(folderPrompt).toBeVisible({ timeout: 60_000 });
  await page.keyboard.press('Enter');
};

/**
 * Wait for an ESR file to appear in the workspace's externalServiceRegistrations folder.
 * `vscode.window.showInformationMessage` toasts auto-dismiss in seconds, so polling for
 * a notification-list-item is racy. The on-disk artifact is the durable success signal.
 */
export const waitForEsrFile = async (workspaceDir: string, baseName: string, timeoutMs = 240_000): Promise<string> => {
  const target = path.join(
    workspaceDir,
    'force-app/main/default/externalServiceRegistrations',
    `${baseName}.externalServiceRegistration-meta.xml`
  );
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fs.access(target);
      return target;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error(`ESR file not found after ${timeoutMs}ms: ${target}`);
};
