/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers manifest-driven deploy + retrieve when the DEFAULT org has NO source tracking.
 *
 * Desktop's fixture opens with a fresh non-tracking org as the default. The container boots a
 * source-TRACKING org as its default, so it uses the multi-org capability (W-23898526): switch the
 * DEFAULT to the second, NON-tracking org (nonTrackingTestOrg, CB_EXTRA_ORG_ALIASES) via the status-bar
 * picker and RESTORE the boot org afterwards (REQUIRED) so the shared serial session is not
 * contaminated. Everything between is shared: a uniquely named throwaway class and manifest, which the
 * container removes BEFORE the boot org is restored, so no stray local change leaks into the tracking
 * boot org. The container skips (never false-fails) when the extra org isn't authed.
 */

import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createNonTrackingOrg,
  upsertScratchOrgAuthFieldsToSettings,
  createApexClass,
  executeEditorContextMenuCommand,
  executeCommandWithCommandPalette,
  validateNoCriticalErrors,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  isDesktop,
  activeQuickInputWidget,
  activeQuickInputTextField,
  EDITOR,
  ensureSecondarySideBarHidden,
  clearOutputChannel,
  closeAllEditors,
  env,
  execAsync,
  expectOrgPickerStatusBar,
  MINIMAL_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS,
  resetContainerWorkbench,
  saveScreenshot,
  switchDefaultOrgViaPicker,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { messages } from '../../../src/messages/i18n';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT, RETRIEVE_TIMEOUT } from '../../constants';
import { isContainer, sharedNonTrackingTest as test } from '../fixtures';
import { cleanupContainerFiles } from '../utils/containerCleanup';

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

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

(isContainer || isDesktop() ? test : test.skip.bind(test))(
  'Non-Tracking Org: deploy/retrieve via manifest work without tracking',
  async ({ page }) => {
    test.setTimeout(RETRIEVE_TIMEOUT);

    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let bootOrgLabel = '';
    let switchedToExtra = false;
    // Unique per run so the container's shared, persistent workbench never collides across runs (and the
    // manifest name never hits the overwrite modal).
    const stamp = Date.now();
    const className = `NonTrackingManifestTest${stamp}`;
    const manifestFile = `nonTrackingManifest${stamp}.xml`;

    if (isContainer) {
      const bootOrgUsername = await resolveOrgUsername(MINIMAL_ORG_ALIAS).catch(() => undefined);
      const extraOrgAuthed = await resolveOrgUsername(NON_TRACKING_ORG_ALIAS).catch(() => undefined);

      test.skip(
        !bootOrgUsername || !extraOrgAuthed,
        `needs both "${MINIMAL_ORG_ALIAS}" (boot) and "${NON_TRACKING_ORG_ALIAS}" (CB_EXTRA_ORG_ALIASES) authed on the host`
      );
      bootOrgLabel = bootOrgUsername!;
    }

    await test.step('setup', async () => {
      // The container's fixture already awaited the workbench, and its boot org is already authed.
      const createResult = isContainer ? undefined : await createNonTrackingOrg();
      if (!isContainer) {
        await waitForVSCodeWorkbench(page);
      }
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      if (createResult) {
        await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      }
      await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.01-ready.png');
    });

    try {
      if (isContainer) {
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
          await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.02-switched-to-nontracking.png');
        });
      }

      await test.step('create source file', async () => {
        await createApexClass(page, className);
      });

      await test.step('generate manifest from apex class', async () => {
        await executeCommandWithCommandPalette(page, packageNls.project_generate_manifest_text);

        const quickInput = activeQuickInputWidget(page);
        await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
        await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });

        await activeQuickInputTextField(page).fill(manifestFile.replace(/\.xml$/i, ''));
        await page.keyboard.press('Enter');

        const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
        await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
        await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.03-manifest-generated.png');
      });

      await test.step('deploy via manifest', async () => {
        const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
        await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
        await manifestEditor.click();
        // The deploy command is only contributed once the manifest editor context keys settle.
        await verifyCommandExists(page, packageNls.deploy_in_manifest_text, 60_000);

        await ensureOutputPanelOpen(page);
        await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
        await clearOutputChannel(page);

        await executeEditorContextMenuCommand(page, packageNls.deploy_in_manifest_text, `manifest/${manifestFile}`);

        // "Deployed Source" is printed only for a deploy that reached the org. The transient "Deploying"
        // toast is racy on a fast deploy, so completion is asserted via output alone.
        await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
        await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.04-deployed.png');
      });

      await test.step('retrieve via manifest', async () => {
        const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
        await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
        await manifestEditor.click();

        await ensureOutputPanelOpen(page);
        await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
        await clearOutputChannel(page);

        await executeEditorContextMenuCommand(page, packageNls.retrieve_in_manifest_text, `manifest/${manifestFile}`);

        await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
        await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: RETRIEVE_TIMEOUT });
        await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.05-retrieved.png');
      });
    } finally {
      if (isContainer) {
        // REQUIRED save/restore so later container specs run against the boot org. Close editors first
        // so the restore step interacts only with the status bar picker.
        await page.keyboard.press('Escape').catch(() => {});
        await closeAllEditors(page).catch(() => {});
        try {
          // Remove the throwaway files while the non-tracking org is still the default, so the tracking
          // boot org never sees them as local changes. Like desktop, the class stays in the org.
          cleanupContainerFiles([
            `force-app/main/default/classes/${className}.cls`,
            `force-app/main/default/classes/${className}.cls-meta.xml`,
            `manifest/${manifestFile}`
          ]);
        } finally {
          if (switchedToExtra) {
            await test.step('restore default org back to the boot org', async () => {
              // Re-drives the picker if the restore doesn't take, so the shared serial session isn't left
              // on nonTrackingTestOrg (which cascades into the next spec's pre-switch assertion).
              await switchDefaultOrgViaPicker(page, {
                fromLabel: NON_TRACKING_ORG_ALIAS,
                filterText: bootOrgLabel,
                expectLabel: bootOrgLabel
              });
              await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.06-restored-boot-org.png');
            });
          }
        }
      }
    }

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
