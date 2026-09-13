/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Code Builder container twin of refreshSObjectDefinitions.headless.
 *
 * The web twin creates a Dreamhouse scratch org, makes it the DEFAULT, and runs `SFDX: Refresh SObject
 * Definitions` to regenerate the faux Apex / typings under `.sfdx/tools/sobjects/...` from that org's
 * schema. The container image boots ONE minimal org (minimalTestOrg, unaliased in-container so it
 * surfaces by USERNAME) that has NO custom objects, so a refresh against it would do no meaningful custom
 * work. This spec leans on the multi-org capability (W-23898526): the orchestrator auths a second,
 * REAL-metadata Dreamhouse org (orgBrowserDreamhouseTestOrg, CB_EXTRA_ORG_ALIASES) into the running
 * container. It switches the DEFAULT to that org through the status-bar picker, runs the CUSTOM refresh,
 * confirms completion via the Salesforce Metadata output channel, then RESTORES the boot org as default
 * so the shared serial session is not contaminated (REQUIRED).
 *
 * WORKABLE (unlike the source-tracking status-bar twins that hit the cross-extension-host config-watcher
 * wall): the refresh command re-resolves the target-org connection FRESH at command time, so — like the
 * sibling deploy/retrieve container specs — it queries whichever org is default when the command runs, no
 * window reload needed. Depends on the CB_EXTRA_ORG_ALIASES multi-org capability; skips (never
 * false-fails) when either org isn't authed on the host — i.e. a local run without the multi-org setup.
 */

import {
  activeQuickInputWidget,
  clearOutputChannel,
  closeWelcomeTabs,
  DREAMHOUSE_ORG_ALIAS,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  executeCommandWithCommandPalette,
  MINIMAL_ORG_ALIAS,
  QUICK_INPUT_LIST_ROW,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  switchDefaultOrgViaPicker,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText,
  WORKBENCH
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import packageNls from '../../../../package.nls.json';

/** Resolve an org's username from the host CLI (the label the in-container picker shows for an unaliased org). */
const resolveOrgUsername = async (alias: string): Promise<string | undefined> => {
  const { stdout } = await execAsync(`sf org display -o ${alias} --json`, { env });
  const parsed = JSON.parse(stdout) as { result?: { username?: string } };
  return parsed.result?.username;
};

// Shared, long-lived workbench: reset editor + notification state before each test rather than assuming a
// clean slate.
test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
});

test('Refresh SObject Definitions (Code Builder): refreshes custom sObjects from the switched Dreamhouse org', async ({
  page
}) => {
  // Budget covers slow container startup, the org switch, and a live Custom-sObject describe against the
  // Dreamhouse org — not org creation (there is none here).
  test.setTimeout(4 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Boot org is unaliased in-container, so the picker/status bar show its USERNAME (resolve from host CLI);
  // the Dreamhouse org keeps its alias in-container.
  const bootOrgUsername = await resolveOrgUsername(MINIMAL_ORG_ALIAS).catch(() => undefined);
  const dreamhouseAuthed = await resolveOrgUsername(DREAMHOUSE_ORG_ALIAS).catch(() => undefined);

  // The Dreamhouse multi-org capability is CI-only (CB_EXTRA_ORG_ALIASES includes orgBrowserDreamhouseTestOrg
  // for this package). Skip — never false-fail — when the host lacks either org, i.e. a local run without it.
  test.skip(
    !bootOrgUsername || !dreamhouseAuthed,
    `needs both "${MINIMAL_ORG_ALIAS}" (boot) and "${DREAMHOUSE_ORG_ALIAS}" (CB_EXTRA_ORG_ALIASES) authed on the host`
  );
  const bootOrgLabel = bootOrgUsername!;

  await test.step('workbench ready', async () => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'refreshSObjectDefinitions.container.01-ready.png');
  });

  await test.step('verify the refresh command is present (extension activated)', async () => {
    await verifyCommandExists(page, packageNls.sobjects_refresh, 60_000);
  });

  let switched = false;
  try {
    await test.step('switch default org to the Dreamhouse org and assert it took', async () => {
      await switchDefaultOrgViaPicker(page, {
        fromLabel: bootOrgLabel,
        filterText: DREAMHOUSE_ORG_ALIAS,
        expectLabel: DREAMHOUSE_ORG_ALIAS,
        assertListsOrg: DREAMHOUSE_ORG_ALIAS
      });
      switched = true;
      await saveScreenshot(page, 'refreshSObjectDefinitions.container.02-switched-to-dreamhouse.png');
    });

    await test.step('run Refresh SObject Definitions for Custom SObjects and confirm via output channel', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await clearOutputChannel(page);
      await page.locator(WORKBENCH).click();

      await executeCommandWithCommandPalette(page, packageNls.sobjects_refresh);

      // Refresh prompts for the category; pick Custom SObjects (the Dreamhouse org's real strength — the
      // boot minimal org has none, so a green result here proves the command re-targeted the switched org).
      const quickInput = activeQuickInputWidget(page);
      await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
      await quickInput.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: packageNls.sobject_refresh_custom }).click({
        force: true
      });
      await saveScreenshot(page, 'refreshSObjectDefinitions.container.03-after-command.png');

      // "Processed N Custom sObjects" line confirms the refresh ran to completion against the default org.
      await waitForOutputChannelText(page, {
        expectedText: packageNls.sobject_refresh_output_custom,
        timeout: 120_000
      });
      await saveScreenshot(page, 'refreshSObjectDefinitions.container.04-refresh-complete.png');
    });
  } finally {
    // REQUIRED save/restore: this shared serial session must not be left with the Dreamhouse org as the
    // default, or later container specs (which assume the boot org) run against the wrong org. Restore
    // through the SAME picker UI. Defensive Escape closes any picker left open by a failed assertion.
    await page.keyboard.press('Escape').catch(() => {});
    if (switched) {
      await test.step('restore the default org back to the boot org', async () => {
        await switchDefaultOrgViaPicker(page, {
          fromLabel: DREAMHOUSE_ORG_ALIAS,
          filterText: bootOrgLabel,
          expectLabel: bootOrgLabel
        });
        await saveScreenshot(page, 'refreshSObjectDefinitions.container.05-restored-boot-org.png');
      });
    }
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
