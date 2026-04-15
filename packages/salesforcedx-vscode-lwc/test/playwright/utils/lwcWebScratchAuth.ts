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

/**
 * VS Code for Web (Code Builder) does not use local CLI auth files. Injects scratch `instanceUrl` and `accessToken`
 * via Settings (same as org-browser). We omit `salesforce-web-console.apiVersion`: SettingsService falls back to
 * 64.0 when unset, and the Settings UI row for apiVersion is brittle across VS Code versions in headless web.
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
    [`${CODE_BUILDER_WEB_SECTION}.${ACCESS_TOKEN_KEY}`]: auth.accessToken
  });
};
