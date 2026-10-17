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
  env,
  execAsync,
  executeCommandWithCommandPalette,
  MINIMAL_ORG_ALIAS,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import * as Schema from 'effect/Schema';
import packageNls from '../../../package.nls.json';
import { isContainer, sharedMinimalDefaultTest as test } from '../fixtures';

const ORG_CHANNEL = 'Salesforce Org Management';

const orgDisplayResponseSchema = Schema.parseJson(
  Schema.Struct({ result: Schema.Struct({ username: Schema.String }) })
);

test('org extension: SFDX: List All Aliases writes aliases to the output channel', async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const username = await test.step('setup', async () => {
    let desktopUsername: string | undefined;
    if (isContainer) {
      // Shared, persistent workbench: reset editor + notification state rather than assuming a clean
      // slate. No org creation — the container's boot org is the shared tracking scratch org.
      await resetContainerWorkbench(page);
    } else {
      await createMinimalOrg();
      const { stdout } = await execAsync(`sf org display --target-org ${MINIMAL_ORG_ALIAS} --json`, { env });
      const result = Schema.decodeUnknownSync(orgDisplayResponseSchema)(stdout);
      await waitForVSCodeWorkbench(page);
      desktopUsername = result.result.username;
    }
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'aliasList.01-ready.png');
    return desktopUsername;
  });

  await test.step('verify localized command is present', async () => {
    await verifyCommandExists(page, packageNls.alias_list_text, 60_000);
  });

  await test.step('run List All Aliases', async () => {
    await executeCommandWithCommandPalette(page, packageNls.alias_list_text);
  });

  await test.step('assert alias table in output channel', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, ORG_CHANNEL, 30_000);
    await waitForOutputChannelText(page, { expectedText: 'Alias', timeout: 60_000 });
    await waitForOutputChannelText(page, { expectedText: 'Username', timeout: 60_000 });
    if (!isContainer) {
      // The container's token boot login registers no alias, so `sf alias list` renders only the
      // header row there. Desktop creates a real, aliased scratch org, so the alias row must appear.
      await waitForOutputChannelText(page, { expectedText: MINIMAL_ORG_ALIAS, timeout: 60_000 });
      await waitForOutputChannelText(page, { expectedText: username as string, timeout: 60_000 });
    }
    await saveScreenshot(page, 'aliasList.02-output-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
