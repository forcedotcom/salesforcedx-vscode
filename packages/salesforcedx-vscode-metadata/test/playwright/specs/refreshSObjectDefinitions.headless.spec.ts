/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers "SFDX: Refresh SObject Definitions", which regenerates the faux Apex / typings under
 * `.sfdx/tools/sobjects/...` from the default org's schema, for the Custom / Standard / All SObjects
 * categories.
 *
 * Container: the container image boots ONE minimal org (minimalTestOrg) that has NO custom objects, so
 * a refresh against it would do no meaningful custom work. This leans on the multi-org capability
 * (W-23898526): the orchestrator auths a second, REAL-metadata Dreamhouse org
 * (orgBrowserDreamhouseTestOrg, CB_EXTRA_ORG_ALIASES) into the running container. It switches the
 * DEFAULT to that org through the status-bar picker, runs ONLY the CUSTOM-SObjects case (Standard/All
 * would add runtime cost not currently budgeted for the container phase — this is intentionally
 * reduced coverage vs. desktop/web's three cases), confirms completion via the output channel, then
 * RESTORES the boot org as default so the shared serial session is not contaminated (REQUIRED). This
 * is workable (unlike the source-tracking status-bar specs that hit the cross-extension-host
 * config-watcher wall) because the refresh command re-resolves the target-org connection FRESH at
 * command time. Skips (never false-fails) when either org isn't authed on the host.
 *
 * The second test below (write-failure surfaces real error) is desktop-only — it forces an EACCES by
 * chmod-ing the real filesystem `workspaceDir`, which has no container equivalent — and is left
 * completely untouched, still using the desktop fixture directly.
 */

import { type Page, expect } from '@playwright/test';
import { dreamhouseDesktopTest } from '../fixtures/desktopFixtures';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createDreamhouseOrg,
  upsertScratchOrgAuthFieldsToSettings,
  executeCommandWithCommandPalette,
  verifyCommandExists,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  outputChannelContains,
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden,
  activeQuickInputWidget,
  isDesktop,
  QUICK_INPUT_LIST_ROW,
  WORKBENCH,
  DREAMHOUSE_ORG_ALIAS,
  env,
  execAsync,
  MINIMAL_ORG_ALIAS,
  resetContainerWorkbench,
  saveScreenshot,
  switchDefaultOrgViaPicker
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs';
import * as path from 'node:path';
import packageNls from '../../../package.nls.json';
import { isContainer, sharedDreamhouseTest as test } from '../fixtures';

const GENERIC_ERROR = 'An error has occurred';

const CUSTOM_TIMEOUT = 30_000;
const STANDARD_TIMEOUT = 120_000;

/** Resolve an org's username from the host CLI (the label the in-container picker shows for an unaliased org). */
const resolveOrgUsername = async (alias: string): Promise<string | undefined> => {
  const { stdout } = await execAsync(`sf org display -o ${alias} --json`, { env });
  const parsed = JSON.parse(stdout) as { result?: { username?: string } };
  return parsed.result?.username;
};

if (isContainer) {
  // Shared, long-lived workbench: reset editor + notification state before each test rather than
  // assuming a clean slate.
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test.setTimeout(STANDARD_TIMEOUT + CUSTOM_TIMEOUT + 60_000);

const runRefreshAndVerify = async (
  page: Page,
  quickPickOption: string,
  expectedOutputText: string,
  timeout: number
) => {
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
  await clearOutputChannel(page);
  await page.locator(WORKBENCH).click();

  await executeCommandWithCommandPalette(page, packageNls.sobjects_refresh);

  const quickInput = activeQuickInputWidget(page);
  await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
  const row = quickInput.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: quickPickOption });
  await expect(row).toBeVisible({ timeout: 10_000 });
  if (isContainer) {
    // eslint-disable-next-line playwright/no-force-option -- quick-pick row re-renders on filter/highlight, invalidating the hover/actionability check
    await row.click({ force: true });
  } else {
    await expect(row).toBeEnabled({ timeout: 10_000 });
    await row.click();
  }

  await waitForOutputChannelText(page, { expectedText: expectedOutputText, timeout });
};

test('Refresh SObject Definitions: Custom, Standard, All via output channel', async ({ page }) => {
  if (isContainer) {
    // Budget covers slow container startup, the org switch, and a live Custom-sObject describe against
    // the Dreamhouse org — not org creation (there is none here).
    test.setTimeout(4 * 60 * 1000);
  }
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let bootOrgLabel = '';
  if (isContainer) {
    // Boot org is unaliased in-container, so the picker/status bar show its USERNAME (resolve from host
    // CLI); the Dreamhouse org keeps its alias in-container.
    const bootOrgUsername = await resolveOrgUsername(MINIMAL_ORG_ALIAS).catch(() => undefined);
    const dreamhouseAuthed = await resolveOrgUsername(DREAMHOUSE_ORG_ALIAS).catch(() => undefined);

    // The Dreamhouse multi-org capability is CI-only. Skip — never false-fail — when the host lacks
    // either org, i.e. a local run without the multi-org setup.
    test.skip(
      !bootOrgUsername || !dreamhouseAuthed,
      `needs both "${MINIMAL_ORG_ALIAS}" (boot) and "${DREAMHOUSE_ORG_ALIAS}" (CB_EXTRA_ORG_ALIASES) authed on the host`
    );
    bootOrgLabel = bootOrgUsername!;
  }

  await test.step('setup', async () => {
    if (isContainer) {
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'refreshSObjectDefinitions.01-ready.png');
      // Extension-activated command confirms the metadata extension is fully initialized.
      await verifyCommandExists(page, packageNls.sobjects_refresh, 60_000);
    } else {
      const createResult = await createDreamhouseOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await waitForOutputChannelText(page, {
        expectedText: 'Salesforce Metadata activation complete',
        timeout: 30_000
      });
      await verifyCommandExists(page, packageNls.sobjects_refresh, 30_000);
    }
  });

  let switched = false;
  try {
    if (isContainer) {
      await test.step('switch default org to the Dreamhouse org and assert it took', async () => {
        await switchDefaultOrgViaPicker(page, {
          fromLabel: bootOrgLabel,
          filterText: DREAMHOUSE_ORG_ALIAS,
          expectLabel: DREAMHOUSE_ORG_ALIAS,
          assertListsOrg: DREAMHOUSE_ORG_ALIAS
        });
        switched = true;
        await saveScreenshot(page, 'refreshSObjectDefinitions.02-switched-to-dreamhouse.png');
      });
    }

    await test.step('Refresh SObject Definitions for Custom SObjects', async () => {
      await runRefreshAndVerify(
        page,
        packageNls.sobject_refresh_custom,
        packageNls.sobject_refresh_output_custom,
        isContainer ? 120_000 : CUSTOM_TIMEOUT
      );
      if (isContainer) {
        await saveScreenshot(page, 'refreshSObjectDefinitions.03-refresh-complete.png');
      }
    });

    // Container intentionally only exercises the Custom case, against the switched Dreamhouse org (the
    // boot minimal org has no custom objects worth refreshing) — Standard/All would add runtime cost
    // not currently budgeted for the container phase. Desktop/web keep the full three-case coverage.
    if (!isContainer) {
      await test.step('Refresh SObject Definitions for Standard SObjects', async () => {
        await runRefreshAndVerify(
          page,
          packageNls.sobject_refresh_standard,
          packageNls.sobject_refresh_output_standard,
          STANDARD_TIMEOUT
        );
      });

      await test.step('Refresh SObject Definitions for All SObjects', async () => {
        await runRefreshAndVerify(
          page,
          packageNls.sobject_refresh_all,
          packageNls.sobject_refresh_output_standard,
          STANDARD_TIMEOUT
        );
        await waitForOutputChannelText(page, {
          expectedText: packageNls.sobject_refresh_output_custom,
          timeout: 10_000
        });
      });
    }
  } finally {
    if (isContainer) {
      // REQUIRED save/restore: this shared serial session must not be left with the Dreamhouse org as
      // the default, or later container specs (which assume the boot org) run against the wrong org.
      // Restore through the SAME picker UI. Defensive Escape closes any picker left open by a failed
      // assertion.
      await page.keyboard.press('Escape').catch(() => {});
      if (switched) {
        await test.step('restore the default org back to the boot org', async () => {
          await switchDefaultOrgViaPicker(page, {
            fromLabel: DREAMHOUSE_ORG_ALIAS,
            filterText: bootOrgLabel,
            expectLabel: bootOrgLabel
          });
          await saveScreenshot(page, 'refreshSObjectDefinitions.04-restored-boot-org.png');
        });
      }
    }
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

// Desktop-only: a real filesystem is needed to force a write (EACCES) failure by chmod-ing the output dir.
// Use the desktop fixture directly so `workspaceDir` is typed; skip when not on desktop.
// Skip on win32: FILE_ATTRIBUTE_READONLY is not honored on directories, so chmod 0o555 does not block
// file/subdir creation inside toolsDir there (learn.microsoft.com/windows/win32/fileio/file-attribute-constants),
// meaning the EACCES failure this test relies on cannot be forced.
const canForceWriteFailure = isDesktop() && process.platform !== 'win32';
const failureTest = canForceWriteFailure
  ? dreamhouseDesktopTest
  : dreamhouseDesktopTest.skip.bind(dreamhouseDesktopTest);
failureTest(
  'Refresh SObject Definitions: write failure surfaces real error, not "An error has occurred"',
  async ({ page, workspaceDir }) => {
    // No validateNoCriticalErrors here: this test intentionally triggers an EACCES write failure,
    // which VS Code also logs to the Electron console. The step assertions below validate the real
    // error is surfaced (EACCES) and the generic string is not — that IS the correctness check.

    // .sfdx/tools is the parent of the sobjects output dir; making it read-only makes createDirectory/writeFile fail.
    const toolsDir = path.join(workspaceDir, '.sfdx', 'tools');

    await test.step('setup dreamhouse org', async () => {
      const createResult = await createDreamhouseOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await waitForOutputChannelText(page, {
        expectedText: 'Salesforce Metadata activation complete',
        timeout: 30_000
      });
      await verifyCommandExists(page, packageNls.sobjects_refresh, 30_000);
    });

    try {
      await test.step('force the output dir read-only, then refresh', async () => {
        fs.mkdirSync(toolsDir, { recursive: true });
        fs.chmodSync(toolsDir, 0o555);

        await clearOutputChannel(page);
        await page.locator(WORKBENCH).click();

        await executeCommandWithCommandPalette(page, packageNls.sobjects_refresh);
        const quickInput = activeQuickInputWidget(page);
        await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
        const row = quickInput.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: packageNls.sobject_refresh_custom });
        await expect(row).toBeVisible({ timeout: 10_000 });
        await expect(row).toBeEnabled({ timeout: 10_000 });
        await row.click();
      });

      await test.step('real permission error is shown, generic string is not', async () => {
        // EACCES/permission text is the real underlying failure the fix surfaces.
        await waitForOutputChannelText(page, { expectedText: 'EACCES', timeout: 60_000 }).catch(async () => {
          await waitForOutputChannelText(page, { expectedText: 'permission denied', timeout: 5000 });
        });
        expect(await outputChannelContains(page, GENERIC_ERROR)).toBe(false);
      });
    } finally {
      fs.chmodSync(toolsDir, 0o755);
    }
  }
);
