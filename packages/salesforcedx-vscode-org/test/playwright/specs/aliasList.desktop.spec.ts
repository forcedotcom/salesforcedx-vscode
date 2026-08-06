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
  env,
  execAsync,
  executeCommandWithCommandPalette,
  MINIMAL_ORG_ALIAS,
  selectOutputChannel,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import * as Schema from 'effect/Schema';
import packageNls from '../../../package.nls.json';
import { orgDesktopMinimalDefaultTest as test } from '../fixtures/desktopFixtures';

const orgDisplayResponseSchema = Schema.parseJson(
  Schema.Struct({ result: Schema.Struct({ username: Schema.String }) })
);

test('org extension: SFDX: List All Aliases writes aliases to the output channel', async ({ page }) => {
  test.setTimeout(120_000);

  const username = await test.step('setup scratch default org', async () => {
    await createMinimalOrg();
    const { stdout } = await execAsync(`sf org display --target-org ${MINIMAL_ORG_ALIAS} --json`, { env });
    const result = Schema.decodeUnknownSync(orgDisplayResponseSchema)(stdout);
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    return result.result.username;
  });

  await test.step('verify localized command is present', async () => {
    await verifyCommandExists(page, packageNls.alias_list_text, 60_000);
  });

  await test.step('run List All Aliases', async () => {
    await executeCommandWithCommandPalette(page, packageNls.alias_list_text);
  });

  await test.step('assert alias table in output channel', async () => {
    await selectOutputChannel(page, 'Salesforce Org Management');
    await waitForOutputChannelText(page, { expectedText: 'Alias', timeout: 60_000 });
    await waitForOutputChannelText(page, { expectedText: 'Username', timeout: 60_000 });
    await waitForOutputChannelText(page, { expectedText: MINIMAL_ORG_ALIAS, timeout: 60_000 });
    await waitForOutputChannelText(page, { expectedText: username, timeout: 60_000 });
  });
});
