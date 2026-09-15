/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Code Builder container twin of nonTrackingOrgDeployRetrieveManifest.headless.
 *
 * The twin proves manifest-driven deploy + retrieve work when the DEFAULT org has NO source tracking. The
 * container boots a source-TRACKING org as its default, so this spec uses the multi-org capability
 * (W-23898526): switch the DEFAULT to the second, NON-tracking org (nonTrackingTestOrg,
 * CB_EXTRA_ORG_ALIASES) via the status-bar picker, then deploy + retrieve a manifest against it, and
 * RESTORE the boot org as default (REQUIRED) so the shared serial session is not contaminated.
 *
 * To avoid mutating the mounted fixture, the manifest is generated from the SEEDED PagedResult.cls (as the
 * boot deploy/retrieve container twins do) under a unique name, rather than creating a new class. The
 * distinct value over deployManifest/retrieveInManifest container twins is that the target default org is
 * NON-tracking. Depends on CB_EXTRA_ORG_ALIASES; skips (never false-fails) when the extra org isn't authed.
 */

import {
  activeQuickInputTextField,
  activeQuickInputWidget,
  clearOutputChannel,
  closeAllEditors,
  closeWelcomeTabs,
  EDITOR,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  executeCommandWithCommandPalette,
  executeEditorContextMenuCommand,
  expectOrgPickerStatusBar,
  MINIMAL_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS,
  openFileFromExplorerTree,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  switchDefaultOrgViaPicker,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { messages } from '../../../../src/messages/i18n';
import packageNls from '../../../../package.nls.json';
import { DEPLOY_TIMEOUT, RETRIEVE_TIMEOUT } from '../../../constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

const FIXTURE_CLASS = 'PagedResult';

/** Resolve an org's username from the host CLI (the label the in-container picker shows for an unaliased org). */
const resolveOrgUsername = async (alias: string): Promise<string> => {
  const { stdout } = await execAsync(`sf org display -o ${alias} --json`, { env });
  const parsed = JSON.parse(stdout) as { result?: { username?: string } };
  const username = parsed.result?.username;
  if (!username) {
    throw new Error(`could not resolve username for org "${alias}" from \`sf org display\``);
  }
  return username;
};

test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
});

test('Non-Tracking Org (Code Builder): deploy/retrieve via manifest work without tracking', async ({ page }) => {
  test.setTimeout(RETRIEVE_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const bootOrgUsername = await resolveOrgUsername(MINIMAL_ORG_ALIAS).catch(() => undefined);
  const extraOrgAuthed = await resolveOrgUsername(NON_TRACKING_ORG_ALIAS).catch(() => undefined);

  test.skip(
    !bootOrgUsername || !extraOrgAuthed,
    `needs both "${MINIMAL_ORG_ALIAS}" (boot) and "${NON_TRACKING_ORG_ALIAS}" (CB_EXTRA_ORG_ALIASES) authed on the host`
  );
  const bootOrgLabel = bootOrgUsername!;

  // Unique manifest name avoids the overwrite modal and collisions in the shared persistent workbench.
  const manifestFile = `nonTrackingManifest${Date.now()}.xml`;

  await test.step('workbench ready', async () => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.container.01-ready.png');
  });

  let switchedToExtra = false;
  try {
    await test.step('switch default org to nonTrackingTestOrg and assert it took', async () => {
      await expectOrgPickerStatusBar(page, bootOrgLabel);
      // Re-drives the picker if the status-bar switch doesn't take (container config-watcher race).
      switchedToExtra = true;
      await switchDefaultOrgViaPicker(page, {
        fromLabel: bootOrgLabel,
        filterText: NON_TRACKING_ORG_ALIAS,
        expectLabel: NON_TRACKING_ORG_ALIAS,
        assertListsOrg: NON_TRACKING_ORG_ALIAS
      });
      await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.container.02-switched-to-nontracking.png');
    });

    await test.step('generate a manifest from the fixture class', async () => {
      await openFileFromExplorerTree(page, `${FIXTURE_CLASS}.cls`, ['force-app', 'main', 'default', 'classes']);
      const editor = page.locator(`[data-uri*="${FIXTURE_CLASS}.cls"]`).first();
      await editor.waitFor({ state: 'visible', timeout: 15_000 });
      await editor.click();

      await executeCommandWithCommandPalette(page, packageNls.project_generate_manifest_text);

      const quickInput = activeQuickInputWidget(page);
      await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
      await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });

      await activeQuickInputTextField(page).fill(manifestFile.replace(/\.xml$/i, ''));
      await page.keyboard.press('Enter');

      const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
      await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
      await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.container.03-manifest-generated.png');
    });

    await test.step('deploy via manifest against the non-tracking org', async () => {
      const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
      await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
      await manifestEditor.click();
      // The deploy command is only contributed once the manifest editor context keys settle.
      await verifyCommandExists(page, packageNls.deploy_in_manifest_text, 60_000);

      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await clearOutputChannel(page);

      await executeEditorContextMenuCommand(page, packageNls.deploy_in_manifest_text, `manifest/${manifestFile}`);
      // The transient "Deploying" toast is racy on a fast container deploy; assert completion via output.
      await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.container.04-deployed.png');
    });

    await test.step('retrieve via manifest against the non-tracking org', async () => {
      const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
      await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
      await manifestEditor.click();

      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await clearOutputChannel(page);

      await executeEditorContextMenuCommand(page, packageNls.retrieve_in_manifest_text, `manifest/${manifestFile}`);

      await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
      await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: RETRIEVE_TIMEOUT });
      await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.container.05-retrieved.png');
    });
  } finally {
    // REQUIRED save/restore so later container specs run against the boot org. Close editors first so the
    // restore step interacts only with the status bar picker.
    await page.keyboard.press('Escape').catch(() => {});
    await closeAllEditors(page).catch(() => {});
    if (switchedToExtra) {
      await test.step('restore default org back to the boot org', async () => {
        // Re-drives the picker if the restore doesn't take, so the shared serial session isn't left
        // on nonTrackingTestOrg (which cascades into the next spec's pre-switch assertion).
        await switchDefaultOrgViaPicker(page, {
          fromLabel: NON_TRACKING_ORG_ALIAS,
          filterText: bootOrgLabel,
          expectLabel: bootOrgLabel
        });
        await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.container.06-restored-boot-org.png');
      });
    }
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
