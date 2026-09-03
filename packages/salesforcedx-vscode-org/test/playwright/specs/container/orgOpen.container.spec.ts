/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Code Builder container twin of orgOpen.desktop (see docs/adr/0022-code-builder-e2e-desktop-build-over-browser.md).
 * Runs against the single shared container fixture + the one tracking scratch org authed as the
 * default target-org at container boot — no org creation here. In container mode the external browser
 * is suppressed; instead org_open_container_mode_message_text ('Access org %s as user %s with the
 * following URL: %s') is surfaced. Asserting the stable 'with the following URL:' fragment proves the
 * `sf` JSON stdout parsed cleanly end-to-end and the URL message was shown — NOT a real browser tab.
 */

import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import packageNls from '../../../../package.nls.json';

const ORG_CHANNEL = 'Salesforce Org Management';

// Shared persistent workbench: reset editor + notification state before each test rather than
// assuming a clean slate.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('org extension (Code Builder): SFDX: Open Default Org surfaces the container-mode URL message', async ({
  page
}) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for workbench', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'orgOpen.container.01-ready.png');
  });

  // Gate on an always-present activation command so we don't get a false negative on slow startup.
  await test.step('verify extension-activated command is present', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
  });

  await test.step('run Open Default Org', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_open_default_scratch_org_text);
  });

  await test.step('assert container-mode URL message in output channel', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, ORG_CHANNEL, 30_000);
    // Stable fragment of org_open_container_mode_message_text ('Access org %s as user %s with the
    // following URL: %s'): the browser is suppressed in container mode and this message is shown
    // instead — its presence proves the JSON stdout parsed cleanly end-to-end.
    await waitForOutputChannelText(page, { expectedText: 'with the following URL:', timeout: 60_000 });
    await saveScreenshot(page, 'orgOpen.container.02-output-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
