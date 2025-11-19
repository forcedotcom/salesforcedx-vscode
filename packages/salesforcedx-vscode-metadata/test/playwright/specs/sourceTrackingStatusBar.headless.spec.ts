/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  filterErrors,
  filterNetworkErrors,
  waitForVSCodeWorkbench,
  create,
  upsertScratchOrgAuthFieldsToSettings
} from 'salesforcedx-vscode-playwright';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';

test.describe('Source Tracking Status Bar', () => {
  test('load verification: status bar shows remote changes after org setup', async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    // Setup scratch org with dreamhouse
    const createResult = await create();

    await waitForVSCodeWorkbench(page);

    // Configure auth settings (this triggers re-auth and connection)
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);

    // Create page object
    const statusBarPage = new SourceTrackingStatusBarPage(page);

    // Wait for status bar to be visible (may take time for connection + source tracking to initialize)
    await statusBarPage.waitForVisible(120_000);

    // Get counts
    const counts = await statusBarPage.getCounts();

    // Verify initial state:
    // - remote changes should be > 0 (dreamhouse was just deployed)
    // - local changes should be 0 (no local edits yet)
    // - conflicts should be 0 (no conflicts yet)
    expect(counts.remote, 'Remote changes should be > 0 after dreamhouse deployment').toBeGreaterThan(0);
    expect(counts.local, 'Local changes should be 0 initially').toBe(0);
    expect(counts.conflicts, 'Conflicts should be 0 initially').toBe(0);

    // Verify no error background (conflicts = 0)
    const hasError = await statusBarPage.hasErrorBackground();
    expect(hasError, 'Status bar should not have error background when conflicts = 0').toBe(false);

    // Validate no critical errors
    const criticalConsole = filterErrors(consoleErrors);
    const criticalNetwork = filterNetworkErrors(networkErrors);

    expect(criticalConsole, `Console errors: ${criticalConsole.map(e => e.text).join(' | ')}`).toHaveLength(0);
    expect(criticalNetwork, `Network errors: ${criticalNetwork.map(e => e.description).join(' | ')}`).toHaveLength(0);
  });
});
