/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import { expect } from '@playwright/test';
import {
  clearOutputChannel,
  createApexClass,
  ensureOutputPanelOpen,
  executeCommandWithCommandPalette,
  expectProblemsCount,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { caseManagerClassText } from '../testData/sampleClassData';
import { getIdealCaseManagerOASDoc } from '../testData/oasDocs';
import {
  assertGenerationOrSkipOnRateLimit,
  clickModalDialogButton,
  confirmEsrFolderPrompt,
  pushSource,
  setupWorkbenchAndAuth,
  setWorkspaceApiVersion,
  waitForA4VAndOasCommands,
  waitForEsrFile,
  writeWorkspaceFile
} from '../utils/oasHelpers';

test.setTimeout(360_000);

test('OAS: composed mode → overwrite → revalidate → deploy', async ({ page, workspaceDir }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup workbench + auth', async () => {
    await setupWorkbenchAndAuth(page);
    // OAS source emits `registrationProviderAsset` (API >=66.0). Default fixture is 64.0.
    // Must reload so source-deploy-retrieve picks up the new sourceApiVersion before deploy.
    await setWorkspaceApiVersion(workspaceDir);
    await executeCommandWithCommandPalette(page, 'Developer: Reload Window');
  });

  await test.step('wait for A4V + OAS commands available', async () => {
    await waitForA4VAndOasCommands(page);
  });

  await test.step('create CaseManager class and push', async () => {
    await createApexClass(page, 'CaseManager', caseManagerClassText);
    await pushSource(page);
  });

  await test.step('generate OAS doc via command palette (composed mode, overwrite)', async () => {
    await openFileByName(page, 'CaseManager.cls');
    await executeCommandWithCommandPalette(page, 'SFDX: Create OpenAPI Document from This Class');
    await confirmEsrFolderPrompt(page);
    await clickModalDialogButton(page, 'Overwrite').catch(() => {});

    // Info toasts auto-dismiss in seconds; the ESR file is the durable success signal.
    // A monthly A4V quota outage surfaces a rate-limit notification instead — skip, don't fail.
    await assertGenerationOrSkipOnRateLimit(test, page, waitForEsrFile(workspaceDir, 'CaseManager'));
  });

  await test.step('replace generated ESR with ideal solution and revalidate', async () => {
    await writeWorkspaceFile(
      workspaceDir,
      'force-app/main/default/externalServiceRegistrations/CaseManager.externalServiceRegistration-meta.xml',
      getIdealCaseManagerOASDoc()
    );

    await openFileByName(page, 'CaseManager.externalServiceRegistration-meta.xml');
    await executeCommandWithCommandPalette(page, 'SFDX: Validate OpenAPI Document');

    const validatedNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Validated OpenAPI Document CaseManager\.externalServiceRegistration-meta\.xml successfully/ })
      .first();
    await expect(validatedNotification).toBeVisible({ timeout: 60_000 });

    // Ideal CaseManager OAS doc validates clean against current linter rules.
    await expectProblemsCount(page, 0, { timeout: 30_000 });
  });

  await test.step('deploy ESR to org', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);

    // Use Push (with ignore-conflicts) instead of "Deploy This Source"; the ideal-XML overwrite
    // diverges source-tracking and "Deploy This Source" surfaces a conflict warning that requires UI interaction.
    await executeCommandWithCommandPalette(page, 'SFDX: Push Source to Default Org and Ignore Conflicts');

    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: 180_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
