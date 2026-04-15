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
  upsertScratchOrgAuthFieldsToSettings
} from '@salesforce/playwright-vscode-ext';

/**
 * VS Code for Web (Code Builder) does not use local CLI auth files. Uses the same helper as Org Browser web E2E:
 * {@link upsertScratchOrgAuthFieldsToSettings} (instanceUrl, accessToken, apiVersion via Settings UI).
 *
 * Local: reuse `orgBrowserDreamhouseTestOrg` or override with `DREAMHOUSE_ORG_ALIAS`. CI: provision the same org as org-browser E2E.
 */
export const applyLwcWebScratchAuth = async (page: Page): Promise<void> => {
  if (isDesktop()) {
    return;
  }
  const auth = await createDreamhouseOrg();
  await upsertScratchOrgAuthFieldsToSettings(page, auth);
};
