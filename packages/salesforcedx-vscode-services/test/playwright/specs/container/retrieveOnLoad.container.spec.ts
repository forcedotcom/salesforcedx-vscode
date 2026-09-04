/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the services extension's retrieve-on-load path (ADR 0022). The web twins
 * (retrieveOnLoad*.headless.spec.ts) cover the positive retrieve; this container spec asserts the
 * activation + no-op branch: the services Effect pipeline comes up in the Node host, its channel is
 * created, and with no `retrieveOnLoad` setting configured it correctly skips retrieval.
 *
 * The positive retrieve path is deliberately left to the web/desktop suites — it is org- and
 * network-bound and (in a container) would require a window reload plus writing retrieved metadata
 * into the shared mounted fixture, which could leak into other packages' specs. The no-op branch is
 * the deterministic, side-effect-free signal that services activated correctly in the image.
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  outputChannelContains,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { SERVICES_CHANNEL_NAME } from '../../../../src/constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

test('Retrieve on load (Code Builder): services activates and skips retrieval with no setting', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('services channel comes up (extension activated in the Node host)', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SERVICES_CHANNEL_NAME);
    // The channel existing + naming itself proves the services extension activated in the container.
    await waitForOutputChannelText(page, { expectedText: SERVICES_CHANNEL_NAME, timeout: 60_000 });
  });

  await test.step('no retrieval is attempted without a retrieveOnLoad setting', async () => {
    const attemptedRetrieval = await outputChannelContains(page, 'Retrieving metadata on load');
    expect(attemptedRetrieval, 'services should not retrieve on load when the setting is unset').toBe(false);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
