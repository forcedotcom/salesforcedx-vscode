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
  NOTIFICATION_LIST_ITEM,
  QUICK_INPUT_WIDGET,
  selectOutputChannel,
  upsertScratchOrgAuthFieldsToSettings,
  verifyCommandExists,
  waitForExtensionsActivated,
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

/** Wait until all extensions finish activating and the OAS commands are registered.
 *
 * The commands are no longer gated by `salesforcedx-einstein-gpt.isEnabled`, so their presence proves only
 * that the OAS extension is active — not that the LLM service the REST path needs has been registered with the
 * service provider yet. The REST path obtains that service fail-fast, so a spec that triggers generation before
 * the providing extension finishes registering its command would flake. Waiting for all extensions to finish
 * activating closes that race. The AuraEnabled path needs only an active org. */
export const waitForA4VAndOasCommands = async (page: Page): Promise<void> => {
  await waitForExtensionsActivated(page);
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

// Re-exported from the shared package so existing spec imports keep working; the default 5000ms timeout
// suits OAS callers that wrap with `.catch` to skip dialogs that only appear when an ESR already exists.
export { clickModalDialogButton } from '@salesforce/playwright-vscode-ext';

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

/** The error notification createApexAction shows when the shared Core model is out of monthly quota.
 * Mirrors the `llm_monthly_rate_limit` message in the extension's i18n. */
const RATE_LIMIT_NOTIFICATION = /monthly rate limit/i;

/**
 * Run an A4V generation's success assertion, but skip the test instead of failing when the cause is
 * the shared Core model's exhausted monthly quota.
 *
 * The extension now surfaces a quota exhaustion as a real error notification ("...hit its monthly
 * rate limit...") rather than swallowing it into the generic "LLM did not return any content", so a
 * spec detects it straight from the UI — no OTEL span file scan needed. A quota outage resets monthly
 * and isn't a product bug, so it's a skip; any other generation failure still fails the test.
 *
 * `success` is the success assertion (e.g. `expect(tab).toBeVisible()` or `waitForEsrFile(...)`). It
 * races the rate-limit notification so a quota outage skips promptly rather than waiting out the
 * assertion's full timeout (the on-disk ESR signal can poll for minutes). If `success` settles first:
 * resolve → done, reject → rethrow. If the notification appears first: `test.skip`.
 *
 * @param test The Playwright `test` object (for `test.skip`).
 * @param page Playwright page.
 * @param success The success assertion; rejects when generation didn't produce its artifact.
 */
export const assertGenerationOrSkipOnRateLimit = async (
  test: { skip: (condition: boolean, description: string) => void },
  page: Page,
  success: Promise<unknown>
): Promise<void> => {
  // The watcher only ever *wins* the race by becoming visible; its own timeout must not settle the
  // race (that's `success`'s job), so a not-found resolves to a promise that never settles. Its
  // timeout is long enough to outlast the slowest generation success window (ESR poll ~240s).
  const rateLimit: Promise<'rate-limit'> = page
    .locator(NOTIFICATION_LIST_ITEM)
    .filter({ hasText: RATE_LIMIT_NOTIFICATION })
    .first()
    .waitFor({ state: 'visible', timeout: 300_000 })
    .then(
      () => 'rate-limit' as const,
      () => new Promise<never>(() => {})
    );
  const outcome = await Promise.race([success.then(() => 'success' as const), rateLimit]);
  test.skip(outcome === 'rate-limit', 'A4V Core model monthly rate limit hit; generation could not run');
};
