/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container coverage for the two Broker__c-specific text-filter subtests of orgBrowser.textFilter.headless
 * that orgBrowser.textFilter.container.spec.ts intentionally OMITS (its boot minimal org has no
 * Dreamhouse `Broker__c` CustomObject). Kept in a SEPARATE spec — rather than mixing switch/non-switch
 * subtests into the boot-org textFilter container spec — using the PROVEN Dreamhouse multi-org pattern
 * (orgBrowserCustomObject.container.spec.ts): each test opens the Org Browser against the boot org,
 * SWITCHES the default to the Dreamhouse org (aliased `orgBrowserDreamhouseTestOrg`, authed via
 * CB_EXTRA_ORG_ALIASES), forces a CustomObject re-query with "Refresh Type", applies the text filter,
 * asserts against `Broker__c`, and RESTORES the default to the boot org in `finally`.
 *
 * Skips (never false-fails) when the boot org or the Dreamhouse extra org isn't authed on the host.
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

// Shared, long-lived workbench: reset editor + notification state and normalize the persisted Org
// Browser filters (both toggles ON, no text filter) so a prior spec can't hide the org's components.
test.beforeEach(async ({ page }) => {
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await closeAllEditors(page);
  await clearAllNotifications(page);
  await normalizeOrgBrowserFilters(new OrgBrowserPage(page));
});

test('Org Browser (Code Builder): text filter CustomObject:Broker__c narrows to the Dreamhouse component', async ({
  page
}) => {
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
  });

  let switched = false;
  try {
    await test.step('switch the default org to the Dreamhouse org', async () => {
      await switchToDreamhouseOrg(page, bootOrgLabel);
      switched = true;
    });

    await test.step('refresh CustomObject so the tree re-queries the switched (Dreamhouse) org', async () => {
      await orgBrowserPage.refreshMetadataType('CustomObject');
    });

    await test.step('apply CustomObject:Broker__c and assert the Broker__c child is listed', async () => {
      await orgBrowserPage.applyTextFilter('CustomObject:Broker__c');
      await orgBrowserPage.expandFolder('CustomObject');
      const components = orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 });
      await expect(components.first()).toBeVisible({ timeout: 10_000 });
      await expect(components.first()).toHaveAccessibleName(/Broker__c/i);
      await saveScreenshot(page, 'orgBrowserTextFilterDreamhouse.container.01-custom-object-broker.png');
    });
  } finally {
    // Defensive Escape closes any picker left open by a failed assertion.
    await page.keyboard.press('Escape').catch(() => {});
    if (switched) {
      await test.step('restore the default org back to the boot org', async () => {
        await restoreBootOrg(page, bootOrgLabel);
      });
    }
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Org Browser (Code Builder): combined wildcard *Object:*Broker* resolves to Dreamhouse CustomObject Broker__c', async ({
  page
}) => {
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
  });

  let switched = false;
  try {
    await test.step('switch the default org to the Dreamhouse org', async () => {
      await switchToDreamhouseOrg(page, bootOrgLabel);
      switched = true;
    });

    await test.step('refresh CustomObject so the tree re-queries the switched (Dreamhouse) org', async () => {
      await orgBrowserPage.refreshMetadataType('CustomObject');
    });

    await test.step('apply *Object:*Broker* and assert it resolves to CustomObject -> Broker__c', async () => {
      await orgBrowserPage.applyTextFilter('*Object:*Broker*');

      const types = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
      await expect(types).toHaveCount(1, { timeout: 10_000 });
      await expect(types.first()).toHaveAccessibleName(/^CustomObject/);

      await orgBrowserPage.expandFolder('CustomObject');
      const components = orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 });
      await expect(components).toHaveCount(1, { timeout: 10_000 });
      await expect(components.first()).toHaveAccessibleName(/Broker__c/i);
      await saveScreenshot(page, 'orgBrowserTextFilterDreamhouse.container.02-wildcard-broker.png');
    });
  } finally {
    // Defensive Escape closes any picker left open by a failed assertion.
    await page.keyboard.press('Escape').catch(() => {});
    if (switched) {
      await test.step('restore the default org back to the boot org', async () => {
        await restoreBootOrg(page, bootOrgLabel);
      });
    }
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
