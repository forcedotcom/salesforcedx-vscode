/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers the tagged-error channel contract: running "SFDX: Deploy Source in Manifest to Org" with NO
 * manifest selected surfaces the tagged [ManifestSelectionRequiredError] in the Salesforce Metadata
 * output channel.
 *
 * Container: the error fires on the manifest-selection guard BEFORE any org round-trip, so this drops
 * the createMinimalOrg / settings upsert and runs against the ambient boot org shape.
 */

import {
  closeAllEditors,
  closeWelcomeTabs,
  clearOutputChannel,
  createMinimalOrg,
  ensureSecondarySideBarHidden,
  executeCommandById,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertScratchOrgAuthFieldsToSettings,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';
import { isContainer, sharedTest as test } from '../fixtures';

test('tagged command errors include the tag only in channel output', async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  if (!isContainer) {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
  }
  // The containerTest fixture already awaited workbench readiness before handing over `page`.
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await verifyCommandExists(page, packageNls.project_info_text, 60_000);
  await closeAllEditors(page);

  await selectOutputChannel(page, 'Salesforce Metadata');
  await clearOutputChannel(page);

  const expectedText = `[ManifestSelectionRequiredError] ${messages.deploy_select_manifest}`;
  await executeCommandById(page, 'sf.metadata.deploy.in.manifest', {
    timeout: 90_000,
    verifyExecution: () => waitForOutputChannelText(page, { expectedText, timeout: 15_000 })
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
