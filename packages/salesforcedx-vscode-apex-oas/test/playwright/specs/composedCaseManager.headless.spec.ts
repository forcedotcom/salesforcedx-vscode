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
  confirmEsrFolderPrompt,
  pushSource,
  setupWorkbenchAndAuth,
  waitForA4VAndOasCommands,
  waitForEsrFile
} from '../utils/oasHelpers';

test.setTimeout(360_000);

test('OAS: composed mode initial generation opens ESR XML and shows success notification', async ({
  page,
  workspaceDir
}) => {
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

  await test.step('generate OAS doc via command palette (composed mode)', async () => {
    await openFileByName(page, 'CaseManager.cls');
    await executeCommandWithCommandPalette(page, 'SFDX: Create OpenAPI Document from This Class');
    await confirmEsrFolderPrompt(page);

    // Info toasts auto-dismiss in seconds; the ESR file is the durable success signal.
    await waitForEsrFile(workspaceDir, 'CaseManager');
  });

  await test.step('verify generated ESR XML tab is open', async () => {
    const esrTab = page.getByRole('tab', { name: 'CaseManager.externalServiceRegistration-meta.xml' }).first();
    await expect(esrTab).toBeVisible({ timeout: 30_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
