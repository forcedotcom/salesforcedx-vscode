/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  verifyCommandExists,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { orgDesktopTest as test } from '../fixtures/desktopFixtures';

test('org extension: SFDX org commands appear in palette when project is open', async ({ page }) => {
  test.setTimeout(120_000);

  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);

  await test.step('Authorize an Org', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
  });

  await test.step('Authorize a Dev Hub', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_dev_hub_text, 60_000);
  });

  await test.step('Set a Default Org', async () => {
    await verifyCommandExists(page, packageNls.config_set_org_text, 60_000);
  });
});
