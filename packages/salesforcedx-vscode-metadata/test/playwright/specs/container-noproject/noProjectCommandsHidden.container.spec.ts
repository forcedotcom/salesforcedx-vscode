/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the "no SFDX project open" visibility rule. The headless twin
 * (noProjectCommandsHidden.headless.spec.ts) opens an EMPTY workspace and asserts the project-gated
 * deploy/retrieve/delete/generate-manifest commands are NOT contributed. This proves the same gate
 * holds inside the Code Builder image.
 *
 * Unlike every other container suite, this one runs against the NON-project workspace shape: the
 * orchestrator opens the standard DX fixture first (for the ./specs/container suites), then re-seeds
 * coder.json to the container-noproject mount (a folder with no sfdx-project.json) and restarts, and
 * runs THIS suite (test:container:noproject) against that shape. It is org-agnostic — the commands
 * are hidden by the missing project, regardless of the ambient boot org.
 *
 * The orchestrator re-runs the extension verify gate after that restart, so reaching a spec here
 * means the metadata extension IS installed and active — a command missing from the palette is the
 * project gate hiding it, not a failure to load the extension.
 */

import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandDoesNotExist
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

test('No project (Code Builder): deploy/retrieve/delete/generate-manifest commands are hidden', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready (non-project folder)', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('project-gated deploy/retrieve/delete/generate-manifest commands do not exist', async () => {
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
});
