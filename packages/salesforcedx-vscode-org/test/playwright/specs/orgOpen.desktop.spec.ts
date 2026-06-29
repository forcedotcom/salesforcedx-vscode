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
  upsertScratchOrgAuthFieldsToSettings,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { orgDesktopMinimalDefaultTest as test } from '../fixtures/desktopFixtures';

// e2e-COVERED: SFDX: Open Default Org against a real scratch default org.
// A real SF project on disk exercises the precondition pass-through AND the --target-org/cwd
// resolution against a live default org — the two adversary concerns jest mocks can't prove.
// openExternal opens a real browser in e2e; we assert via the output channel only (per the WI).
// The access message text appearing proves stdout parsed cleanly end-to-end against the real sf
// CLI — direct coverage of the SF_JSON_TO_STDOUT concern.
test('org extension: SFDX: Open Default Org logs the access message to the output channel', async ({ page }) => {
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

  await test.step('run Open Default Org', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_open_default_scratch_org_text);
  });

  await test.step('assert access message in output channel', async () => {
    await selectOutputChannel(page, 'Salesforce Org Management');
    // stable fragment of org_open_container_mode_message_text ('Access org %s as user %s with the
    // following URL: %s') — its presence proves the JSON stdout parsed cleanly end-to-end.
    await waitForOutputChannelText(page, { expectedText: 'with the following URL:', timeout: 60_000 });
  });
});
