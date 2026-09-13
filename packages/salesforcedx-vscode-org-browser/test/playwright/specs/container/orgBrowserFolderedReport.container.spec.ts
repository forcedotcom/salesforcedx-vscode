/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container twin of orgBrowser.folderedReport.headless (ADR 0022), using the PROVEN Dreamhouse
 * multi-org pattern (orgBrowserCustomObject.container.spec.ts). Exercises FOLDERED metadata navigation
 * (type -> report folder -> report), which universal boot-org types don't cover. NOTE (honesty):
 * trailheadapps/dreamhouse-lwc ships NO reports directory; the report asserted here
 * (`unfiled$public/flow_screen_prebuilt_report`) is a STANDARD org report present in the Dreamhouse
 * scratch org — the same node the headless twin asserts. The value ported is the container's ability
 * to surface a foldered Report against the SWITCHED default org, not Dreamhouse-authored report metadata.
 *
 * Opens the Org Browser against the boot org FIRST (so the switch re-targets an already-populated
 * panel), SWITCHES the default to the Dreamhouse org (aliased `orgBrowserDreamhouseTestOrg`, authed via
 * CB_EXTRA_ORG_ALIASES), forces a Report re-query with "Refresh Type", then navigates
 * Report -> unfiled$public -> the report node. RESTORES the default to the boot org in `finally`.
 *
 * Skips (never false-fails) when the boot org or the Dreamhouse extra org isn't authed on the host.
 */

import { expect } from '@playwright/test';
import {
  DREAMHOUSE_ORG_ALIAS,
  MINIMAL_ORG_ALIAS,
  resetContainerWorkbench,
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

const REPORT_TYPE = 'Report';
/** Public report folder present in every org (Dreamhouse scratch org included). */
const REPORT_FOLDER = 'unfiled$public';
/** Standard report node under the public folder — the same node the headless twin asserts. */
const REPORT_ITEM = 'unfiled$public/flow_screen_prebuilt_report';

// Shared, long-lived workbench: reset editor + notification state and normalize the persisted Org
// Browser filters (both toggles ON, no text filter) so a prior spec can't hide the org's components.
test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
  await normalizeOrgBrowserFilters(new OrgBrowserPage(page));
});

test('Org Browser (Code Builder): surfaces a foldered Report against the switched Dreamhouse org', async ({ page }) => {
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
    await saveScreenshot(page, 'orgBrowserFolderedReport.container.01-boot-org-open.png');
  });

  let switched = false;
  try {
    await test.step('switch the default org to the Dreamhouse org', async () => {
      await switchToDreamhouseOrg(page, bootOrgLabel);
      switched = true;
      await saveScreenshot(page, 'orgBrowserFolderedReport.container.02-switched-to-dreamhouse.png');
    });

    await test.step('refresh Report so the tree re-queries the switched (Dreamhouse) org', async () => {
      await orgBrowserPage.refreshMetadataType(REPORT_TYPE);
    });

    await test.step(`expand ${REPORT_TYPE} and locate the ${REPORT_FOLDER} folder`, async () => {
      await orgBrowserPage.expandFolder(REPORT_TYPE);
      const folder = await orgBrowserPage.getMetadataItem(REPORT_TYPE, REPORT_FOLDER, 2);
      await expect(folder).toHaveRole('treeitem');
      await expect(folder).toHaveAttribute('aria-level', '2');
      await orgBrowserPage.expandFolder(REPORT_FOLDER, 2);
      await saveScreenshot(page, 'orgBrowserFolderedReport.container.03-report-folder.png');
    });

    await test.step(`assert the foldered report ${REPORT_ITEM} is listed at level 3`, async () => {
      const item = await orgBrowserPage.getMetadataItem(REPORT_FOLDER, REPORT_ITEM, 3);
      await expect(item).toHaveRole('treeitem');
      await expect(item).toHaveAttribute('aria-level', '3');
      await saveScreenshot(page, 'orgBrowserFolderedReport.container.04-foldered-report.png');
    });
  } finally {
    // Defensive Escape closes any picker left open by a failed assertion.
    await page.keyboard.press('Escape').catch(() => {});
    if (switched) {
      await test.step('restore the default org back to the boot org', async () => {
        await restoreBootOrg(page, bootOrgLabel);
        await saveScreenshot(page, 'orgBrowserFolderedReport.container.05-restored-boot-org.png');
      });
    }
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
