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
  executeCommandWithCommandPalette,
  selectOutputChannel,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { orgDesktopMinimalDefaultTest as test } from '../fixtures/desktopFixtures';

// e2e-COVERED: SFDX: Display Org Details for Default Org against a real scratch default org.
// Unlike orgOpen (which shells out to sf), this path goes through ConnectionService.getConnection(),
// which resolves TARGET_ORG from the project `.sfdx/config.json` the orgAlias fixture writes — so a
// live, queryable default org is required. The table output proves getConnection + Organization SOQL +
// table render end-to-end; jest only covers the dispatch/guards with mocks.
test('org extension: SFDX: Display Org Details for Default Org logs the org table to the output channel', async ({
  page
}) => {
  test.setTimeout(120_000);

  await test.step('setup scratch default org', async () => {
    // creates/reuses the minimalTestOrg so the alias in .sfdx/config.json resolves to a live org
    await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
  });

  // Gate on an always-present activation command so we don't get a false negative on slow startup.
  await test.step('verify extension-activated command is present', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
  });

  await test.step('run Display Org Details for Default Org', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_display_default_text);
  });

  await test.step('assert org table in output channel', async () => {
    await selectOutputChannel(page, 'Salesforce Org Management');
    // 'Connected Status' is an unconditional row of formatOrgInfoAsTable; its presence proves
    // getConnection + Organization SOQL + table render completed against the live default org.
    await waitForOutputChannelText(page, { expectedText: 'Connected Status', timeout: 60_000 });
  });
});
