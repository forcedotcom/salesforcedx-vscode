/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import { expect } from '@playwright/test';
import {
  createApexClass,
  executeCommandWithCommandPalette,
  openFileByName,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { caseManagerClassText } from '../testData/sampleClassData';
import {
  assertGenerationOrSkipOnRateLimit,
  clickModalDialogButton,
  confirmEsrFolderPrompt,
  pushSource,
  setupWorkbenchAndAuth,
  waitForA4VAndOasCommands,
  waitForEsrFile
} from '../utils/oasHelpers';

test.setTimeout(600_000);
// This spec uniquely invokes A4V twice back-to-back (overwrite then manual merge).
// Empty-content responses from the second A4V call are the dominant flake signature; retry once.
test.describe.configure({ retries: 1 });

test('OAS: composed mode → manual merge produces diff editor + timestamped ESR', async ({ page, workspaceDir }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup workbench + auth', async () => {
    await setupWorkbenchAndAuth(page);
  });

  await test.step('wait for A4V + OAS commands available', async () => {
    await waitForA4VAndOasCommands(page);
  });

  await test.step('create CaseManager class and push', async () => {
    await createApexClass(page, 'CaseManager', caseManagerClassText);
    await pushSource(page);
  });

  await test.step('first generation: overwrite (creates baseline ESR)', async () => {
    await openFileByName(page, 'CaseManager.cls');
    await executeCommandWithCommandPalette(page, 'SFDX: Create OpenAPI Document from This Class');
    await confirmEsrFolderPrompt(page);
    await clickModalDialogButton(page, 'Overwrite').catch(() => {});
    // Info toasts auto-dismiss in seconds; the ESR file is the durable success signal.
    // A monthly A4V quota outage surfaces a rate-limit notification instead — skip, don't fail.
    await assertGenerationOrSkipOnRateLimit(test, page, waitForEsrFile(workspaceDir, 'CaseManager'));
  });

  await test.step('second generation: manual merge', async () => {
    await executeCommandWithCommandPalette(page, 'View: Close All Editors').catch(() => {});
    await openFileByName(page, 'CaseManager.cls');
    await executeCommandWithCommandPalette(page, 'SFDX: Create OpenAPI Document from This Class');
    await confirmEsrFolderPrompt(page);
    // The merge dialog renders first; generation runs after the merge button is clicked and can take 30-180s.
    await clickModalDialogButton(page, 'Manually merge with existing ESR', 180_000);
    // Manual-merge writes a CaseManager_<ts>.externalServiceRegistration-meta.xml; verify on disk via tab below.
  });

  await test.step('verify diff editor and timestamped ESR tabs are open', async () => {
    const diffTab = page.getByRole('tab', { name: /Manual Diff of ESR XML Files/ }).first();
    // The merge generation needs a fresh A4V LLM response. When the shared Core model is out of its
    // monthly quota, the command shows a rate-limit error notification and no diff opens — an infra
    // outage, not a product bug. Skip rather than fail; the quota resets monthly.
    await assertGenerationOrSkipOnRateLimit(test, page, expect(diffTab).toBeVisible({ timeout: 30_000 }));

    const timestampedTab = page
      .getByRole('tab', { name: /CaseManager_\d{8}_\d{6}\.externalServiceRegistration-meta\.xml/ })
      .first();
    await expect(timestampedTab).toBeVisible({ timeout: 30_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
