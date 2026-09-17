/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the "SFDX: Create Project" entry points, case B (folder open, NO
 * sfdx-project.json). The desktop twin (emptyWorkspaceSfdxCommands.desktop.spec.ts) has two cases:
 *   A) no folder open  → Create Project / Create Project with Manifest are present
 *   B) folder open, no project → same two commands are present
 * This spec covers case B against the NON-project workspace shape the orchestrator re-seeds for the
 * test:container:noproject phase (a folder with no sfdx-project.json). Case A (no folder open) is
 * covered by the container-nofolder suite.
 *
 * The Create Project commands are contributed statically and gated only on
 * `!sf:internal_dev && (!isWeb || (isWeb && sf:code_builder_enabled))`. In the Code Builder image
 * isWeb is true and the services extension (activationEvents "*") sets sf:code_builder_enabled=true,
 * so the commands are contributed regardless of whether an SFDX project is open — the opposite of the
 * project-gated commands noProjectCommandsHidden asserts are hidden.
 */

import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

test('SFDX Create Project commands (Code Builder): present with a folder open but no sfdx-project.json', async ({
  page
}) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready (non-project folder)', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('Create Project commands exist', async () => {
    await verifyCommandExists(page, packageNls.project_generate_text, 60_000);
    await verifyCommandExists(page, packageNls.project_generate_with_manifest_text, 60_000);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
