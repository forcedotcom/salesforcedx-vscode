/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { emptyWorkspaceDesktopTest } from '../fixtures';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  assertWelcomeTabExists,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  verifyCommandDoesNotExist,
  validateNoCriticalErrors,
  isDesktop
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';

(isDesktop() ? emptyWorkspaceDesktopTest : emptyWorkspaceDesktopTest.skip.bind(emptyWorkspaceDesktopTest))(
  'No project: LWC/Apex create and deploy/retrieve/delete commands hidden',
  async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await emptyWorkspaceDesktopTest.step('setup with empty workspace', async () => {
      await waitForVSCodeWorkbench(page);
      await assertWelcomeTabExists(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
    });

    await emptyWorkspaceDesktopTest.step('verify tempaltes commands do not exist', async () => {
      await verifyCommandDoesNotExist(page, packageNls.lightning_generate_lwc_text);
    });

    await emptyWorkspaceDesktopTest.step('verify deploy/retrieve/delete/generate manifest do not exist', async () => {
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

    await validateNoCriticalErrors(emptyWorkspaceDesktopTest, consoleErrors, networkErrors);
  }
);
