/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Code Builder container twin of workspaceContextOrgSwitch.desktop
 * (see docs/adr/0022-code-builder-e2e-desktop-build-over-browser.md).
 *
 * The desktop twin loads a test-only fixture extension (test/playwright/fixtureExtensions/workspaceContext,
 * via createDesktopTest's `testExtensionPaths`) that consumes Core's public WorkspaceContext API,
 * captures `onOrgChange` events + synchronous getter values, and writes `.workspace-context-state.json`
 * for fine-grained assertions (eventCount, per-event username/alias/orgId).
 *
 * WHAT THIS PORTS + how it proves the workspace context follows a default-org switch:
 *   The pre-built Code Builder container runs PRODUCTION extensions only — `createContainerTest`
 *   has no `testExtensionPaths` hook, so the fixture extension (and thus the state file / test
 *   commands) cannot be loaded. This port therefore proves the SAME observable outcome — the
 *   workspace's in-process default-org context tracks a real picker switch — through a production
 *   signal instead of the fixture extension:
 *     `SFDX: Display Org Details for Default Org` (orgDisplayDefaultCommand) reads Core's
 *     `TargetOrgRef` SubscriptionRef (the WorkspaceContext-backed target org) and shells
 *     `sf org display --target-org "<that username>" --json`. So the org whose table it renders is
 *     exactly whatever WorkspaceContext currently holds. Asserting the rendered username flips from
 *     the boot org to the switched org (with no window reload) is the container-observable proof that
 *     the WorkspaceContext transition completed and downstream commands consume the new default.
 *
 * WHAT THIS OMITS (needs the fixture extension the production container can't load): the twin's
 * exact `onOrgChange` event-count / per-event getter assertions. Those observe the WorkspaceContext
 * API surface directly from a consumer extension and have no production-command proxy.
 *
 * MULTI-ORG (W-23898526): the switch is only possible because the container now has a SECOND org —
 * the orchestrator auths CB_EXTRA_ORG_ALIASES (nonTrackingTestOrg in CI) into the running container
 * after boot but before the workbench restart, on top of the token-authed boot org (the DEFAULT).
 *
 * ALIAS vs USERNAME: the boot org is token-authed and carries NO alias in-container, so the status
 * bar / picker show its USERNAME (resolved here from the host CLI); nonTrackingTestOrg was authed
 * with `--alias`, so it surfaces by that alias. Same rationale as orgPicker.container.
 *
 * REQUIRED restore: this shared serial session must be left with the boot org as the default, or
 * later container specs run against the wrong org — the default is restored in a `finally`.
 *
 * Skips (never false-fails) when the host lacks either org — a local run without the multi-org setup
 * (CB_EXTRA_ORG_ALIASES is CI-only, gated to the multi-org packages).
 */

import {
  clickOrgPickerStatusBar,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  executeCommandWithCommandPalette,
  expectOrgPickerStatusBar,
  MINIMAL_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS,
  resetContainerWorkbench,
  saveScreenshot,
  selectOrgInPicker,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';

// `channel_name` from salesforcedx-vscode-org/src/messages/i18n.ts — orgDisplay writes its table here.
const ORG_OUTPUT_CHANNEL = 'Salesforce Org Management';
// `org_display_default_text` from salesforcedx-vscode-org/package.nls.json. Hardcoded (not imported)
// to avoid a cross-package relative import from the core test tsconfig.
const DISPLAY_DEFAULT_ORG_COMMAND = 'SFDX: Display Org Details for Default Org';

/** Resolve an org's username from the host CLI (the label the in-container status bar shows for an unaliased org). */
const resolveOrgUsername = async (alias: string): Promise<string> => {
  const { stdout } = await execAsync(`sf org display -o ${alias} --json`, { env });
  const parsed = JSON.parse(stdout) as { result?: { username?: string } };
  const username = parsed.result?.username;
  if (!username) {
    throw new Error(`could not resolve username for org "${alias}" from \`sf org display\``);
  }
  return username;
};

// Shared persistent workbench: reset editor + notification state before each test rather than
// assuming a clean slate.
test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
});

test('core (Code Builder): WorkspaceContext default-org tracks a real picker switch', async ({ page }) => {
  // Generous budget for slow container startup + two cold `sf org display` shell-outs; no org creation.
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Boot org is unaliased in-container -> status bar shows its USERNAME; nonTrackingTestOrg keeps its alias.
  const bootOrgUsername = await resolveOrgUsername(MINIMAL_ORG_ALIAS).catch(() => undefined);
  const extraOrgUsername = await resolveOrgUsername(NON_TRACKING_ORG_ALIAS).catch(() => undefined);

  // The multi-org capability is CI-only (CB_EXTRA_ORG_ALIASES). Skip — never false-fail — when the
  // host lacks either org, i.e. a local run without the multi-org setup.
  test.skip(
    !bootOrgUsername || !extraOrgUsername,
    `multi-org port needs both "${MINIMAL_ORG_ALIAS}" (boot) and "${NON_TRACKING_ORG_ALIAS}" (CB_EXTRA_ORG_ALIASES) authed on the host`
  );
  const bootOrgLabel = bootOrgUsername!;
  const extraOrgUsernameValue = extraOrgUsername!;

  await test.step('wait for workbench', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'workspaceContextOrgSwitch.container.01-ready.png');
  });

  await test.step('baseline: status bar shows the boot org as the default', async () => {
    // Doubles as the activation gate — the org-picker status bar only renders once the org extension
    // has activated and the TargetOrgRef watcher has resolved the boot default.
    await expectOrgPickerStatusBar(page, bootOrgLabel, { timeout: 60_000 });
  });

  await test.step('baseline: default-org command resolves WorkspaceContext to the boot org', async () => {
    // orgDisplayDefaultCommand reads TargetOrgRef and shells `sf org display --target-org <boot> --json`,
    // so the boot org's username in the rendered table is the pre-switch snapshot of WorkspaceContext.
    await executeCommandWithCommandPalette(page, DISPLAY_DEFAULT_ORG_COMMAND);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, ORG_OUTPUT_CHANNEL, 30_000);
    await waitForOutputChannelText(page, { expectedText: bootOrgLabel, timeout: 60_000 });
    await saveScreenshot(page, 'workspaceContextOrgSwitch.container.02-baseline-boot.png');
  });

  let switchedToExtra = false;
  try {
    await test.step('switch the default org to nonTrackingTestOrg via the status-bar picker', async () => {
      await clickOrgPickerStatusBar(page, bootOrgLabel);
      await selectOrgInPicker(page, NON_TRACKING_ORG_ALIAS);
      switchedToExtra = true;
      // The TargetOrgRef watcher refreshes the status bar after the config write — no reload needed.
      await expectOrgPickerStatusBar(page, NON_TRACKING_ORG_ALIAS);
      await saveScreenshot(page, 'workspaceContextOrgSwitch.container.03-switched-to-extra.png');
    });

    await test.step('WorkspaceContext now resolves the switched org for the default-org command', async () => {
      // Same command, no reload: it must now render the SWITCHED org's table. Its username appears in
      // the channel only after the switch — the container-observable proof the transition completed and
      // WorkspaceContext-backed commands consume the new default.
      await executeCommandWithCommandPalette(page, DISPLAY_DEFAULT_ORG_COMMAND);
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, ORG_OUTPUT_CHANNEL, 30_000);
      await waitForOutputChannelText(page, { expectedText: extraOrgUsernameValue, timeout: 60_000 });
      await saveScreenshot(page, 'workspaceContextOrgSwitch.container.04-switched-context.png');
    });
  } finally {
    // REQUIRED save/restore: never leave nonTrackingTestOrg as the default, or later container specs
    // run against the wrong org. Restore through the SAME picker UI. Defensive Escape closes any picker
    // left open by a failed assertion above.
    await page.keyboard.press('Escape').catch(() => {});
    if (switchedToExtra) {
      await test.step('restore the default org back to the boot org', async () => {
        await clickOrgPickerStatusBar(page, NON_TRACKING_ORG_ALIAS);
        await selectOrgInPicker(page, bootOrgLabel);
        await expectOrgPickerStatusBar(page, bootOrgLabel);
        await saveScreenshot(page, 'workspaceContextOrgSwitch.container.05-restored-boot.png');
      });
    }
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
