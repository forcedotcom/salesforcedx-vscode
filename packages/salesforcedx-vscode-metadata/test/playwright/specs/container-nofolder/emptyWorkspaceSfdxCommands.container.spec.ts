/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the "SFDX: Create Project" entry points, case A (NO folder open). The desktop
 * twin (emptyWorkspaceSfdxCommands.desktop.spec.ts) launches an empty (folder-less) window and
 * asserts Create Project / Create Project with Manifest are present. This proves the same holds in
 * the Code Builder image when code-server opens with no folder.
 *
 * The orchestrator re-seeds coder.json to an empty query (no folder key) + restarts before the
 * test:container:nofolder phase, so this suite runs against a truly folder-less window. The Create
 * Project commands are contributed statically and gated only on
 * `!sf:internal_dev && (!isWeb || (isWeb && sf:code_builder_enabled))`; the services extension
 * (activationEvents "*") sets sf:code_builder_enabled=true on startup even with no folder, so the
 * commands are contributed. The re-run verify gate proves the metadata extension is still installed.
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

test('SFDX Create Project commands (Code Builder): present with no folder open', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready (no folder open)', async () => {
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
