/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container twin of orgBrowser.customTab.headless (ADR 0022), using the PROVEN Dreamhouse multi-org
 * pattern (orgBrowserCustomObject.container.spec.ts). The headless twin retrieves the Dreamhouse
 * `Broker__c` CustomTab from a per-test Dreamhouse scratch org; the boot minimal org the container
 * boots has no such tab. This spec opens the Org Browser against the boot org FIRST (so the switch
 * below re-targets an already-populated panel — the actual spike question), SWITCHES the default to
 * the Dreamhouse org (aliased `orgBrowserDreamhouseTestOrg`, authed via CB_EXTRA_ORG_ALIASES), forces
 * a CustomTab re-query with "Refresh Type", and asserts the Dreamhouse `Broker__c` CustomTab node.
 * RESTORES the default to the boot org in `finally` so later serial specs run against the right org.
 *
 * Skips (never false-fails) when the boot org or the Dreamhouse extra org isn't authed on the host —
 * a local run without the multi-org + Dreamhouse setup — mirroring orgBrowserCustomObject.container.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  DREAMHOUSE_ORG_ALIAS,
  ensureSecondarySideBarHidden,
  MINIMAL_ORG_ALIAS,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { OrgBrowserPage } from '../../pages/orgBrowserPage';
import { containerTest as test } from '../../fixtures/containerFixtures';
import {
  normalizeOrgBrowserFilters,
  resolveMultiOrgLabels,
  restoreBootOrg,
  switchToDreamhouseOrg
} from './containerHelpers';

/** A Dreamhouse CustomTab present after `sf project deploy start` of trailheadapps/dreamhouse-lwc. */
const DREAMHOUSE_CUSTOM_TAB = 'Broker__c';

// Shared, long-lived workbench: reset editor + notification state and normalize the persisted Org
// Browser filters (both toggles ON, no text filter) so a prior spec can't hide the org's components.
test.beforeEach(async ({ page }) => {
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await closeAllEditors(page);
  await clearAllNotifications(page);
  await normalizeOrgBrowserFilters(new OrgBrowserPage(page));
});

test('Org Browser (Code Builder): surfaces the switched Dreamhouse org CustomTab', async ({ page }) => {
  test.setTimeout(4 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const orgBrowserPage = new OrgBrowserPage(page);

  const { bootOrgUsername, dreamhouseAuthed } = await resolveMultiOrgLabels();
  test.skip(
    !bootOrgUsername || !dreamhouseAuthed,
    `dreamhouse probe needs both "${MINIMAL_ORG_ALIAS}" (boot) and "${DREAMHOUSE_ORG_ALIAS}" (CB_EXTRA_ORG_ALIASES) authed on the host`
  );
  const bootOrgLabel = bootOrgUsername!;

  await test.step('open the Org Browser against the boot org (caches its describe)', async () => {
    await orgBrowserPage.openOrgBrowser();
    await saveScreenshot(page, 'orgBrowserCustomTab.container.01-boot-org-open.png');
  });

  let switched = false;
  try {
    await test.step('switch the default org to the Dreamhouse org', async () => {
      await switchToDreamhouseOrg(page, bootOrgLabel);
      switched = true;
      await saveScreenshot(page, 'orgBrowserCustomTab.container.02-switched-to-dreamhouse.png');
    });

    await test.step('refresh CustomTab so the tree re-queries the switched (Dreamhouse) org', async () => {
      await orgBrowserPage.refreshMetadataType('CustomTab');
    });

    await test.step(`expand CustomTab and assert the Dreamhouse tab ${DREAMHOUSE_CUSTOM_TAB} is listed`, async () => {
      await orgBrowserPage.expandFolder('CustomTab');
      const item = await orgBrowserPage.getMetadataItem('CustomTab', DREAMHOUSE_CUSTOM_TAB);
      await expect(item).toHaveRole('treeitem');
      await expect(item).toHaveAttribute('aria-level', '2');
      await expect(item).toHaveAccessibleName(new RegExp(DREAMHOUSE_CUSTOM_TAB));
      await saveScreenshot(page, 'orgBrowserCustomTab.container.03-dreamhouse-custom-tab.png');
    });
  } finally {
    // Defensive Escape closes any picker left open by a failed assertion.
    await page.keyboard.press('Escape').catch(() => {});
    if (switched) {
      await test.step('restore the default org back to the boot org', async () => {
        await restoreBootOrg(page, bootOrgLabel);
        await saveScreenshot(page, 'orgBrowserCustomTab.container.04-restored-boot-org.png');
      });
    }
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
