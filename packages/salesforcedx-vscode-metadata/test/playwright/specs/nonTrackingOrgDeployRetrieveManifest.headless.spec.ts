/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers manifest-driven deploy + retrieve when the DEFAULT org has NO source tracking.
 *
 * Container: the container boots a source-TRACKING org as its default, so this uses the multi-org
 * capability (W-23898526): switch the DEFAULT to the second, NON-tracking org (nonTrackingTestOrg,
 * CB_EXTRA_ORG_ALIASES) via the status-bar picker, run the scenario against it, and RESTORE the boot
 * org as default (REQUIRED) so the shared serial session is not contaminated — a genuinely different,
 * container-specific mechanism from desktop's per-run createNonTrackingOrg, so it is branched rather
 * than unified. To avoid mutating the mounted fixture, the manifest is generated from the seeded
 * PagedResult.cls under a unique name, rather than creating a new class. Skips (never false-fails) when
 * the extra org isn't authed.
 */

import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createNonTrackingOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
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
  openFileFromExplorerTree,
  resetContainerWorkbench,
  saveScreenshot,
  switchDefaultOrgViaPicker,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import { messages } from '../../../src/messages/i18n';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT, RETRIEVE_TIMEOUT } from '../../constants';
import { isContainer, sharedNonTrackingTest as test } from '../fixtures';

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

    let className: string;
    let bootOrgLabel = '';
    let switchedToExtra = false;
    // Unique manifest name in the container avoids the overwrite modal and collisions in the shared
    // persistent workbench; desktop/headless accept the default "package.xml" since each run gets a
    // fresh org.
    const manifestFile = isContainer ? `nonTrackingManifest${Date.now()}.xml` : 'package.xml';

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
      if (isContainer) {
        // The containerTest fixture already awaited workbench readiness before handing over `page`.
        await closeWelcomeTabs(page);
        await ensureSecondarySideBarHidden(page);
        await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.01-ready.png');
      } else {
        const createResult = await createNonTrackingOrg();
        await waitForVSCodeWorkbench(page);
        await closeWelcomeTabs(page);
        await ensureSecondarySideBarHidden(page);
        await upsertScratchOrgAuthFieldsToSettings(page, createResult);

        // Disable deploy-on-save so test can control when deploys happen
        await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
      }
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
        if (isContainer) {
          // Use the seeded fixture class rather than mutating the shared workbench with a new one.
          // The Explorer tree open can transiently flake on the shared workbench (virtual scrolling /
          // focus), so retry the open+focus as a unit.
          await expect(async () => {
            await openFileFromExplorerTree(page, `${FIXTURE_CLASS}.cls`, ['force-app', 'main', 'default', 'classes']);
            const editor = page.locator(`[data-uri*="${FIXTURE_CLASS}.cls"]`).first();
            await editor.waitFor({ state: 'visible', timeout: 15_000 });
            await editor.click();
          }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });
        } else {
          className = `NonTrackingTest${Date.now()}`;
          await createApexClass(page, className);
        }
      });

      await test.step('generate manifest from apex class', async () => {
        await executeCommandWithCommandPalette(page, packageNls.project_generate_manifest_text);

        const quickInput = activeQuickInputWidget(page);
        await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
        await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });

        if (isContainer) {
          await activeQuickInputTextField(page).fill(manifestFile.replace(/\.xml$/i, ''));
        }
        await page.keyboard.press('Enter');

        const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
        await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
        if (isContainer) {
          await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.03-manifest-generated.png');
        }
      });

      await test.step('deploy via manifest', async () => {
        if (isContainer) {
          const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
          await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
          await manifestEditor.click();
          // The deploy command is only contributed once the manifest editor context keys settle.
          await verifyCommandExists(page, packageNls.deploy_in_manifest_text, 60_000);
        }

        await ensureOutputPanelOpen(page);
        await selectOutputChannel(page, 'Salesforce Metadata', isContainer ? 60_000 : undefined);
        if (isContainer) {
          await clearOutputChannel(page);
        }

        await executeEditorContextMenuCommand(page, packageNls.deploy_in_manifest_text, `manifest/${manifestFile}`);

        if (isContainer) {
          // The transient "Deploying" toast is racy on a fast container deploy; assert completion via output.
          await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
          await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.04-deployed.png');
        } else {
          const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
          await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });

          await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: 30_000 });
        }
      });

      await test.step('retrieve via manifest', async () => {
        if (isContainer) {
          const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
          await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
          await manifestEditor.click();
        }

        await ensureOutputPanelOpen(page);
        await selectOutputChannel(page, 'Salesforce Metadata', isContainer ? 60_000 : undefined);
        if (isContainer) {
          await clearOutputChannel(page);
        }

        await executeEditorContextMenuCommand(page, packageNls.retrieve_in_manifest_text, `manifest/${manifestFile}`);

        await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
        await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: RETRIEVE_TIMEOUT });
        if (isContainer) {
          await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.05-retrieved.png');
        }
      });
    } finally {
      if (isContainer) {
        // REQUIRED save/restore so later container specs run against the boot org. Close editors first
        // so the restore step interacts only with the status bar picker.
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
            await saveScreenshot(page, 'nonTrackingDeployRetrieveManifest.06-restored-boot-org.png');
          });
        }
      }
    }

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
