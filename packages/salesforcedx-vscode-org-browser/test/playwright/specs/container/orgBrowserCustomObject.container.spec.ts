/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * FEASIBILITY SPIKE (W-23898526): Dreamhouse-org support for the Org Browser in the Code Builder
 * container. The web twins (orgBrowser.customObject.headless) retrieve Dreamhouse metadata against a
 * per-test Dreamhouse scratch org; the org-light container twins (orgBrowser.container /
 * orgBrowser.describe.container) only prove universal types resolve against the boot org. This spec
 * bridges the two: it browses REAL custom metadata (Dreamhouse `Property__c`/`Broker__c`) inside the
 * container — the thing the boot minimal org lacks.
 *
 * THE SPIKE QUESTION: Org Browser always browses the DEFAULT org's metadata. The container boots ONE
 * org (minimalTestOrg, unaliased — see orgPicker.container.spec.ts). CI additionally auths a Dreamhouse
 * scratch org aliased `orgBrowserDreamhouseTestOrg` into the container via CB_EXTRA_ORG_ALIASES
 * (.github/workflows/codeBuilderE2E.yml). The unknown: after the Org Browser has already opened against
 * the boot org (caching its describe), does SWITCHING the default to the Dreamhouse org make the panel
 * surface THAT org's custom objects — WITHOUT the window reload the code-server web container can't do?
 * (The metadata source-tracking status bar hit exactly this cross-extension-host caching wall and had
 * two specs test.fixme'd.) So this spec deliberately opens the browser against the boot org FIRST, then
 * switches, so the probe exercises the "re-target a cached panel" path, not a fresh open.
 *
 * READ ON FEASIBILITY (harness evidence, not a guarantee — CI is the real probe): the Org Browser
 * reacts to the default-org change in-process. src/index.ts subscribes to `TargetOrgRef.changes`
 * (deduped by orgId) and calls `treeProvider.refreshType()` on every switch; and getChildren reads the
 * CURRENT TargetOrgRef orgId on demand and queries a per-org OrgMetadataCatalog (former-org acquisitions
 * are discarded via suppressInactiveOrgOperation). So it does NOT bake in the boot org at activation.
 * This spec ALSO explicitly clicks the type's "Refresh Type" toolbar action (consistency: 'refresh')
 * after the switch to force the new-org re-query rather than leaning on the auto-refresh timing. RISK:
 * if TargetOrgRef doesn't propagate the switch to the Org Browser's (web) extension host without a
 * reload — the same wall source-tracking hit — this spec fails in CI and the answer to the spike is
 * "Org Browser needs a reload the web container can't do", i.e. this spec would need test.fixme like the
 * source-tracking twins. That failure is the intended signal.
 *
 * Skips (never false-fails) when the boot org or the Dreamhouse extra org isn't authed on the host —
 * i.e. a local run without the multi-org + Dreamhouse setup — mirroring orgPicker.container.spec.ts.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  DREAMHOUSE_ORG_ALIAS,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  MINIMAL_ORG_ALIAS,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  switchDefaultOrgViaPicker,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { OrgBrowserPage } from '../../pages/orgBrowserPage';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { normalizeOrgBrowserFilters } from './containerHelpers';

/** A Dreamhouse custom object present after `sf project deploy start` of trailheadapps/dreamhouse-lwc. */
const DREAMHOUSE_CUSTOM_OBJECT = 'Property__c';

/** Resolve an org's username from the host CLI (the label the in-container picker shows for an unaliased org). */
const resolveOrgUsername = async (alias: string): Promise<string | undefined> => {
  const { stdout } = await execAsync(`sf org display -o ${alias} --json`, { env });
  const parsed = JSON.parse(stdout) as { result?: { username?: string } };
  return parsed.result?.username;
};

// Shared, long-lived workbench: reset editor + notification state and normalize the persisted Org
// Browser filters (both toggles ON, no text filter) so a prior spec can't hide the org's components.
test.beforeEach(async ({ page }) => {
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await closeAllEditors(page);
  await clearAllNotifications(page);
  await normalizeOrgBrowserFilters(new OrgBrowserPage(page));
});

test('Org Browser (Code Builder): surfaces the switched Dreamhouse org custom objects', async ({ page }) => {
  // Budget covers slow container startup, the async status-bar refresh after the switch, and a live
  // CustomObject listMetadata against the Dreamhouse org — not org creation (there is none here).
  test.setTimeout(4 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const orgBrowserPage = new OrgBrowserPage(page);

  // Boot org is unaliased in-container, so the picker/status bar show its USERNAME — resolve it from the
  // host CLI (the host authed both orgs). The Dreamhouse org keeps its alias in-container.
  const bootOrgUsername = await resolveOrgUsername(MINIMAL_ORG_ALIAS).catch(() => undefined);
  const dreamhouseAuthed = await resolveOrgUsername(DREAMHOUSE_ORG_ALIAS).catch(() => undefined);

  // The Dreamhouse multi-org capability is CI-only (CB_EXTRA_ORG_ALIASES=orgBrowserDreamhouseTestOrg for
  // this package). Skip — never false-fail — when the host lacks either org, i.e. a local run without it.
  test.skip(
    !bootOrgUsername || !dreamhouseAuthed,
    `dreamhouse probe needs both "${MINIMAL_ORG_ALIAS}" (boot) and "${DREAMHOUSE_ORG_ALIAS}" (CB_EXTRA_ORG_ALIASES) authed on the host`
  );
  const bootOrgLabel = bootOrgUsername!;

  await test.step('open the Org Browser against the boot org (caches its describe)', async () => {
    // Opening FIRST, before the switch, is deliberate: it makes the switch below re-target an
    // already-populated panel — the actual spike question — rather than a fresh open.
    await orgBrowserPage.openOrgBrowser();
    await saveScreenshot(page, 'orgBrowserCustomObject.container.01-boot-org-open.png');
  });

  let switched = false;
  try {
    await test.step('switch the default org to the Dreamhouse org', async () => {
      await switchDefaultOrgViaPicker(page, {
        fromLabel: bootOrgLabel,
        filterText: DREAMHOUSE_ORG_ALIAS,
        expectLabel: DREAMHOUSE_ORG_ALIAS,
        assertListsOrg: DREAMHOUSE_ORG_ALIAS
      });
      switched = true;
      await saveScreenshot(page, 'orgBrowserCustomObject.container.02-switched-to-dreamhouse.png');
    });

    await test.step('refresh CustomObject so the tree re-queries the switched (Dreamhouse) org', async () => {
      // Force the new-org re-query rather than depending on the auto-refresh watcher's timing. If the
      // Org Browser could NOT re-target the switched org without a window reload, this + the assertion
      // below is where the spike fails in CI (see the file header risk note).
      await orgBrowserPage.refreshMetadataType('CustomObject');
    });

    await test.step(`expand CustomObject and assert the Dreamhouse object ${DREAMHOUSE_CUSTOM_OBJECT} is listed`, async () => {
      await orgBrowserPage.expandFolder('CustomObject');
      const item = await orgBrowserPage.getMetadataItem('CustomObject', DREAMHOUSE_CUSTOM_OBJECT);
      await expect(item).toHaveRole('treeitem');
      await expect(item).toHaveAttribute('aria-level', '2');
      await expect(item).toHaveAccessibleName(new RegExp(DREAMHOUSE_CUSTOM_OBJECT));
      await saveScreenshot(page, 'orgBrowserCustomObject.container.03-dreamhouse-custom-object.png');
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
        await saveScreenshot(page, 'orgBrowserCustomObject.container.04-restored-boot-org.png');
      });
    }
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
