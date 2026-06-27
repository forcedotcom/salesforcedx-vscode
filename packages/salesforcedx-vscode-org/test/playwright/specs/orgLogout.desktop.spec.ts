/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  activeQuickInputTextField,
  activeQuickInputWidget,
  clickOrgPickerStatusBar,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  executeCommandWithCommandPalette,
  expectOrgPickerStatusBar,
  QUICK_INPUT_LIST_ROW,
  selectOutputChannel,
  selectQuickInputOptionByTyping,
  waitForNotification,
  waitForOutputChannelText,
  waitForQuickInputFirstOption,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { orgDesktopLogoutTest as test } from '../fixtures/desktopFixtures';

// `missing_default_org` from salesforcedx-vscode-org/src/messages/i18n.ts (not in package.nls.json).
const NO_DEFAULT_ORG = 'No Default Org Set';
// `channel_name` from salesforcedx-vscode-org/src/messages/i18n.ts.
const ORG_OUTPUT_CHANNEL = 'Salesforce Org Management';
// `org_logout_scratch_logout` from salesforcedx-vscode-org/src/messages/i18n.ts — the scratch confirm button.
const LOGOUT_CONFIRM_LABEL = 'Logout';
// `%s successfully ran` (salesforcedx-utils-vscode/src/messages/i18n.ts), %s = command description.
const CREATE_SCRATCH_ORG_RAN = /SFDX: Create a Default Scratch Org\.\.\. successfully ran/;
// `org_logout_default_text` + `%s successfully ran`; output-channel match is a literal substring.
const LOGOUT_DEFAULT_RAN = `${packageNls.org_logout_default_text} successfully ran`;

// End-to-end coverage of sf.org.logout.default: create a default scratch org through the extension,
// then log out from it. Exercises the real AuthRemover.removeAuth disk removal + scratch-confirm modal,
// asserted via the durable output-channel success text.
test('org logout: SFDX Log Out from Default Org removes auth from the default scratch org', async ({
  page
}, testInfo) => {
  // Scratch org creation can take several minutes; allow generous headroom.
  test.setTimeout(720_000);

  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);

  // Create the org through the extension (not a raw config write) so the TargetOrgRef atom refreshes
  // and logout has a real default to remove. Mirrors orgPicker.desktop.spec's create-default-scratch flow.
  const scratchAlias = `TempScratchOrg_${Date.now()}_${testInfo.workerIndex}_${Math.random().toString(36).slice(2)}`;
  await test.step('create a default scratch org via the picker', async () => {
    await clickOrgPickerStatusBar(page, NO_DEFAULT_ORG);
    await selectQuickInputOptionByTyping(page, packageNls.org_create_default_scratch_org_text);
    // Prompt 1: scratch-def file picker (workspace has exactly one config/*-scratch-def.json).
    await waitForQuickInputFirstOption(page);
    await activeQuickInputWidget(page)
      .locator(QUICK_INPUT_LIST_ROW)
      .filter({ hasText: 'project-scratch-def.json' })
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.press('Enter');
    // Prompt 2: alias input box.
    const input = activeQuickInputTextField(page);
    await expect(input, 'alias input box should be empty after the file picker commits').toHaveValue('', {
      timeout: 30_000
    });
    await page.keyboard.type(scratchAlias);
    await page.keyboard.press('Enter');
    // Prompt 3: expiration days input box.
    await expect(input, 'expiration-days input box should be empty after the alias commits').toHaveValue('', {
      timeout: 30_000
    });
    await page.keyboard.type('1');
    await page.keyboard.press('Enter');
  });

  // `--set-default` makes the new org the default. Wait for the create command's success notification
  // (multi-minute command), then the status bar confirms the TargetOrgRef atom refreshed.
  await test.step('scratch org create completes and is set as default', async () => {
    await waitForNotification(page, CREATE_SCRATCH_ORG_RAN, { timeout: 600_000 });
    await expectOrgPickerStatusBar(page, scratchAlias, { timeout: 30_000 });
  });

  // Log out from the default org. The org is a scratch org, so ScratchOrgLogoutParamsGatherer surfaces a
  // confirm modal; confirm it to proceed (dialogStyle: custom routes it through the DOM).
  await test.step('log out from the default org and confirm the scratch modal', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_logout_default_text);
    await clickModalDialogButton(page, LOGOUT_CONFIRM_LABEL);
  });

  // Durable success signal: removeAuth ran end-to-end and the command reported success. The status bar
  // also reverts to "No Default Org Set" once the default org's auth is gone.
  await test.step('output channel reports the logout command succeeded', async () => {
    await selectOutputChannel(page, ORG_OUTPUT_CHANNEL);
    await waitForOutputChannelText(page, { expectedText: LOGOUT_DEFAULT_RAN });
    await expectOrgPickerStatusBar(page, NO_DEFAULT_ORG, { timeout: 30_000 });
  });

  // Best-effort cleanup: logout removed the local auth, so delete by alias may already be a no-op.
  // The org auto-expires in 1 day; guard so a delete failure doesn't fail a passing test.
  await test.step('delete the created scratch org', async () => {
    await execAsync(`sf org delete scratch --target-org ${scratchAlias} --no-prompt`, { env }).catch(
      (error: unknown) => {
        console.warn(`Failed to delete scratch org ${scratchAlias}; it will expire in 1 day. ${String(error)}`);
      }
    );
  });
});

/** Click a VS Code custom modal-dialog button by its label (requires `window.dialogStyle: custom`). */
const clickModalDialogButton = async (page: Page, label: string, timeout = 15_000): Promise<void> => {
  const dialogButton = page
    .locator('.monaco-dialog-box, .dialog-shadow')
    .getByRole('button', { name: label, exact: true })
    .first();
  await expect(dialogButton).toBeVisible({ timeout });
  await dialogButton.click();
};
