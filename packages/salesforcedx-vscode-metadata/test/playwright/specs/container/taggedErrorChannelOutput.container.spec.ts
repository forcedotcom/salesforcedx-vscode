/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the tagged-error channel contract. The headless twin
 * (taggedErrorChannelOutput.headless.spec.ts) runs "SFDX: Deploy Source in Manifest to Org" with NO
 * manifest selected and asserts the Salesforce Metadata channel carries the tagged
 * [ManifestSelectionRequiredError]. This proves the same tag reaches the channel inside the Code
 * Builder image.
 *
 * The error fires on the manifest-selection guard BEFORE any org round-trip, so this drops the
 * headless twin's createMinimalOrg / settings upsert and runs against the ambient boot org shape.
 */

import {
  clearOutputChannel,
  closeAllEditors,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandById,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../../package.nls.json';
import { messages } from '../../../../src/messages/i18n';
import { containerTest as test } from '../../fixtures/containerFixtures';

test('Tagged error channel output (Code Builder): deploy-in-manifest with no manifest carries the error tag', async ({
  page
}) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await verifyCommandExists(page, packageNls.project_info_text, 60_000);
    await closeAllEditors(page);
  });

  await test.step('select + clear the Salesforce Metadata channel', async () => {
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);
  });

  await test.step('deploy-in-manifest with no manifest emits the tagged error', async () => {
    const expectedText = `[ManifestSelectionRequiredError] ${messages.deploy_select_manifest}`;
    await executeCommandById(page, 'sf.metadata.deploy.in.manifest', {
      timeout: 90_000,
      verifyExecution: () => waitForOutputChannelText(page, { expectedText, timeout: 15_000 })
    });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
