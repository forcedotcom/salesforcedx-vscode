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
  waitForOutputChannelPredicate,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { orgDesktopMinimalDefaultTest as test } from '../fixtures/desktopFixtures';

// e2e-COVERED: SFDX: Display Org Details for Default Org against a real scratch default org.
// Like orgOpen, this path shells out to `sf org display --target-org <default> --json` via
// TerminalService.simpleExec, with the username coming from TargetOrgRef (seeded from the project
// `.sfdx/config.json` the orgAlias fixture writes) — so a live, authed default org is required. The
// table output proves the CLI round-trip + JSON decode + table render end-to-end; jest only covers
// the dispatch/guards with mocks.
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
    // 'Connected Status' is an unconditional row of formatOrgInfoAsTable; its presence proves the
    // `sf org display --json` round-trip + table render completed against the live default org.
    await waitForOutputChannelText(page, { expectedText: 'Connected Status', timeout: 60_000 });
    for (const width of [1920, 700]) {
      await test.step(`verify Access Token at ${width}px viewport width`, async () => {
        await page.setViewportSize({ width, height: 1080 });
        await waitForOutputChannelPredicate(page, {
          predicate: lines => {
            // A table row can span visual lines. Alias bounds the token value so an empty
            // cell cannot consume the next row. Keep credentials inside the browser.
            const text = lines
              .map(line => line.textContent ?? '')
              .join(' ')
              .replaceAll('\u00A0', ' ');
            const token = /Access Token\s+(.*?)Alias/s.exec(text)?.[1]?.trim();
            // The access token is explicitly fetched, not copied from Org Display's redacted JSON.
            return Boolean(token) && !text.includes('[REDACTED]');
          },
          message: 'Access Token row should contain a non-empty, non-redacted value',
          timeout: 10_000
        });
      });
    }
  });
});
