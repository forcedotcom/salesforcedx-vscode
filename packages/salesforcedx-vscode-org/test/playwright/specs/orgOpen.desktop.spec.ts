/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  closeWelcomeTabs,
  createMinimalOrg,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertScratchOrgAuthFieldsToSettings,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { isContainer, sharedMinimalDefaultTest as test } from '../fixtures';

const ORG_CHANNEL = 'Salesforce Org Management';

// e2e-COVERED: SFDX: Open Default Org against a live default org. A real SF project on disk exercises
// the precondition pass-through AND the --target-org/cwd resolution against a live default org — the
// two adversary concerns jest mocks can't prove. In container mode the external browser is suppressed
// and org_open_container_mode_message_text ('Access org %s as user %s with the following URL: %s')
// is surfaced instead; asserting the stable 'with the following URL:' fragment proves the `sf` JSON
// stdout parsed cleanly end-to-end on either side (openExternal opens a real browser on desktop; we
// still assert via the output channel only, per the WI).
test('org extension: SFDX: Open Default Org logs the access message to the output channel', async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup', async () => {
    if (isContainer) {
      // Shared, persistent workbench: reset editor + notification state rather than assuming a clean
      // slate. No org creation — the container's boot org is the shared tracking scratch org.
      await resetContainerWorkbench(page);
    } else {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    }
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'orgOpen.01-ready.png');
  });

  // Gate on an always-present activation command so we don't get a false negative on slow startup.
  await test.step('verify extension-activated command is present', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
  });

  await test.step('run Open Default Org', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_open_default_scratch_org_text);
  });

  await test.step('assert access message in output channel', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, ORG_CHANNEL, 30_000);
    // stable fragment of org_open_container_mode_message_text ('Access org %s as user %s with the
    // following URL: %s') — its presence proves the JSON stdout parsed cleanly end-to-end.
    await waitForOutputChannelText(page, { expectedText: 'with the following URL:', timeout: 60_000 });
    await saveScreenshot(page, 'orgOpen.02-output-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
