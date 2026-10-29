/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isContainer, sharedEmptyWorkspaceTest as test } from '../fixtures';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  verifyCommandDoesNotExist,
  validateNoCriticalErrors,
  isDesktop
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';

// On Code Builder this runs in the test:container:noproject phase, whose seeded workspace is a folder
// with no sfdx-project.json. The orchestrator re-runs the extension verify gate after that phase's
// restart, so a command missing from the palette there is the project gate hiding it, not a failure
// to load the extension.
(isDesktop() || isContainer ? test : test.skip.bind(test))(
  'No project: LWC/Apex create and deploy/retrieve/delete commands hidden',
  async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('setup with empty workspace', async () => {
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      if (!isContainer) {
        await waitForVSCodeWorkbench(page);
      }
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
    });

    await test.step('verify deploy/retrieve/delete/generate manifest do not exist', async () => {
      await verifyCommandDoesNotExist(page, packageNls.project_deploy_start_default_org_text);
      await verifyCommandDoesNotExist(page, packageNls.project_deploy_start_ignore_conflicts_default_org_text);
      await verifyCommandDoesNotExist(page, packageNls.project_retrieve_start_default_org_text);
      await verifyCommandDoesNotExist(page, packageNls.project_retrieve_start_ignore_conflicts_default_org_text);
      await verifyCommandDoesNotExist(page, packageNls.deploy_this_source_text);
      await verifyCommandDoesNotExist(page, packageNls.deploy_in_manifest_text);
      await verifyCommandDoesNotExist(page, packageNls.retrieve_this_source_text);
      await verifyCommandDoesNotExist(page, packageNls.retrieve_in_manifest_text);
      await verifyCommandDoesNotExist(page, packageNls.delete_source_text);
      await verifyCommandDoesNotExist(page, packageNls.project_generate_manifest_text);
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
