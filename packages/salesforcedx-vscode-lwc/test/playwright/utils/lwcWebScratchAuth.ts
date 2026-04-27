/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Page } from '@playwright/test';
import {
  createDreamhouseOrg,
  isDesktop,
  upsertSettings,
  upsertScratchOrgAuthFieldsToSettings,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';

/** Same keys as `salesforcedx-vscode-metadata` `src/constants.ts` (core owns push-or-deploy-on-save). */
const CORE_CONFIG_SECTION = 'salesforcedx-vscode-core';
const PUSH_OR_DEPLOY_ON_SAVE_ENABLED = 'push-or-deploy-on-save.enabled';

/**
 * Disable deploy-on-save on web without provisioning a scratch org.
 * Use for LSP tests that save files but do not need real org connectivity — prevents
 * "Deploy on save failed: Value for instanceUrl is empty" console errors.
 * Is a no-op on desktop.
 */
export const disableDeployOnSaveWeb = async (page: Page): Promise<void> => {
  if (isDesktop()) {
    return;
  }
  // Wait for the workspace to be ready before writing workspace-scoped settings — writing to
  // the Workspace settings tab before the workspace folder is mounted silently writes to the
  // wrong scope and the setting has no effect (same pattern as upsertScratchOrgAuthFieldsToSettings).
  await waitForWorkspaceReady(page);
  await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${PUSH_OR_DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
};

/**
 * Simulates what Code Builder does: receives `instanceUrl`, `accessToken`, and `instanceApiVersion` from core
 * and injects them via VS Code Settings. Auth files are created in the global CLI home as a byproduct — they
 * just don't appear inside the project folder.
 *
 * Also disables **Deploy on Save**: with a real org token every `File: Save` would trigger a deploy and surface
 * conflict noise in the console (see metadata E2E: `deploySourcePath.headless.spec.ts`), which fails
 * `validateNoCriticalErrors`.
 *
 * Local: reuse `orgBrowserDreamhouseTestOrg` or override with `DREAMHOUSE_ORG_ALIAS`. CI: provision the same org as org-browser E2E.
 */
export const applyLwcWebScratchAuth = async (page: Page): Promise<void> => {
  if (isDesktop()) {
    return;
  }
  const auth = await createDreamhouseOrg();
  await upsertScratchOrgAuthFieldsToSettings(page, auth);
  await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${PUSH_OR_DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
};
