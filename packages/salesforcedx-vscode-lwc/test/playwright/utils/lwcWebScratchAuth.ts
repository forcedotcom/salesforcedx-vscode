/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Page } from '@playwright/test';
import {
  CODE_BUILDER_WEB_SECTION,
  createDreamhouseOrg,
  INSTANCE_URL_KEY,
  ACCESS_TOKEN_KEY,
  isDesktop,
  upsertSettings,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';

/** Same keys as `salesforcedx-vscode-metadata` `src/constants.ts` (core owns push-or-deploy-on-save). */
const CORE_CONFIG_SECTION = 'salesforcedx-vscode-core';
const PUSH_OR_DEPLOY_ON_SAVE_ENABLED = 'push-or-deploy-on-save.enabled';

/**
 * VS Code for Web (Code Builder) does not use local CLI auth files. Injects scratch `instanceUrl` and `accessToken`
 * via Settings (same as org-browser). We omit `salesforce-web-console.apiVersion`: SettingsService falls back to
 * 64.0 when unset, and the Settings UI row for apiVersion is brittle across VS Code versions in headless web.
 *
 * With a real org token, **Deploy on Save** would run on every `File: Save` and surface conflict noise in the console
 * (see metadata E2E: `deploySourcePath.headless.spec.ts`). Those messages fail `validateNoCriticalErrors`, so we turn
 * deploy-on-save off here for all LWC web specs that use this helper.
 *
 * Local: reuse `orgBrowserDreamhouseTestOrg` or override with `DREAMHOUSE_ORG_ALIAS`. CI: provision the same org as org-browser E2E.
 */
export const applyLwcWebScratchAuth = async (page: Page): Promise<void> => {
  if (isDesktop()) {
    return;
  }
  const auth = await createDreamhouseOrg();
  await waitForVSCodeWorkbench(page, true);
  await waitForWorkspaceReady(page);
  await upsertSettings(page, {
    [`${CODE_BUILDER_WEB_SECTION}.${INSTANCE_URL_KEY}`]: auth.instanceUrl,
    [`${CODE_BUILDER_WEB_SECTION}.${ACCESS_TOKEN_KEY}`]: auth.accessToken,
    [`${CORE_CONFIG_SECTION}.${PUSH_OR_DEPLOY_ON_SAVE_ENABLED}`]: 'false'
  });
};
