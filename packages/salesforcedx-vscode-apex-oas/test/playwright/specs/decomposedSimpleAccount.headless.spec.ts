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
  reloadWindow,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { simpleAccountResourceClassText } from '../testData/sampleClassData';
import {
  getIdealSimpleAccountResourceXml,
  getIdealSimpleAccountResourceYaml,
  getSfdxProjectJson
} from '../testData/oasDocs';
import {
  assertGenerationOrSkipOnRateLimit,
  confirmEsrFolderPrompt,
  pushSource,
  setupWorkbenchAndAuth,
  waitForA4VAndOasCommands,
  writeWorkspaceFile
} from '../utils/oasHelpers';

test.setTimeout(360_000);

test('OAS: decomposed mode opens YAML+XML, validates, deploys', async ({ page, workspaceDir }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup workbench + auth', async () => {
    await setupWorkbenchAndAuth(page);
  });

  await test.step('switch project to decomposed-ESR mode and reload', async () => {
    await writeWorkspaceFile(workspaceDir, 'sfdx-project.json', getSfdxProjectJson());
    await reloadWindow(page);
  });

  await test.step('wait for A4V + OAS commands available after reload', async () => {
    await waitForA4VAndOasCommands(page);
  });

  await test.step('create SimpleAccountResource class and push', async () => {
    await createApexClass(page, 'SimpleAccountResource', simpleAccountResourceClassText);
    await pushSource(page);
  });

  await test.step('generate decomposed OAS doc via command palette', async () => {
    await openFileByName(page, 'SimpleAccountResource.cls');
    await executeCommandWithCommandPalette(page, 'SFDX: Create OpenAPI Document from This Class');
    await confirmEsrFolderPrompt(page);

    const successNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /OpenAPI Document created for class: SimpleAccountResource\./ })
      .first();
    // A monthly A4V quota outage surfaces a rate-limit notification instead — skip, don't fail.
    await assertGenerationOrSkipOnRateLimit(test, page, expect(successNotification).toBeVisible({ timeout: 180_000 }));
  });

  await test.step('verify YAML + XML tabs both open', async () => {
    const yamlTab = page.getByRole('tab', { name: 'SimpleAccountResource.yaml' }).first();
    const xmlTab = page
      .getByRole('tab', { name: 'SimpleAccountResource.externalServiceRegistration-meta.xml' })
      .first();
    await expect(yamlTab).toBeVisible({ timeout: 30_000 });
    await expect(xmlTab).toBeVisible({ timeout: 30_000 });
  });

  await test.step('replace YAML + XML with ideal solution and revalidate', async () => {
    await writeWorkspaceFile(
      workspaceDir,
      'force-app/main/default/externalServiceRegistrations/SimpleAccountResource.yaml',
      getIdealSimpleAccountResourceYaml()
    );
    await writeWorkspaceFile(
      workspaceDir,
      'force-app/main/default/externalServiceRegistrations/SimpleAccountResource.externalServiceRegistration-meta.xml',
      getIdealSimpleAccountResourceXml()
    );

    await openFileByName(page, 'SimpleAccountResource.yaml');
    await executeCommandWithCommandPalette(page, 'SFDX: Validate OpenAPI Document');

    const validatedNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Validated OpenAPI Document SimpleAccountResource\.yaml successfully/ })
      .first();
    await expect(validatedNotification).toBeVisible({ timeout: 60_000 });

    await expectProblemsCount(page, 0, { timeout: 30_000 });
  });

  await test.step('deploy decomposed ESR to org', async () => {
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
