/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  closeWelcomeTabs,
  createMinimalOrg,
  ensureSecondarySideBarHidden,
  upsertScratchOrgAuthFieldsToSettings,
  verifyCommandExists,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { orgDesktopMinimalDefaultTest as test } from '../fixtures/desktopFixtures';

// A scratch org is a deletable default (isScratch === true) so sf:default_org_deletable is true
// and SFDX: Delete Default Org must appear in the palette.
// The negative (hidden) case requires a production / non-scratch-non-sandbox default org, for
// which there is no e2e helper; it is covered by the updateContext jest test and manual verification.
test('org extension: SFDX: Delete Default Org is visible when the default org is a scratch org', async ({ page }) => {
  test.setTimeout(120_000);

  await test.step('setup scratch default org', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
  });

  // Gate on an always-present activation command so we don't get a false negative on slow startup.
  await test.step('verify extension-activated command is present', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
  });

  await test.step('verify Delete Default Org is visible', async () => {
    await verifyCommandExists(page, packageNls.org_delete_default_text, 30_000);
  });
});
