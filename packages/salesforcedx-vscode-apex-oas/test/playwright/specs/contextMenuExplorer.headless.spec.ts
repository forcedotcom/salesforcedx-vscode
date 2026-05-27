/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import {
  createApexClass,
  executeCommandWithCommandPalette,
  executeExplorerContextMenuCommand,
  isMacDesktop,
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

// Explorer context menu doesn't fire reliably on macOS Electron — legacy test fell back to palette there.
test('OAS: explorer context menu generates OAS doc', async ({ page, workspaceDir }) => {
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

  await test.step('invoke OAS via explorer context menu (palette fallback on macOS)', async () => {
    if (isMacDesktop()) {
      await openFileByName(page, 'CaseManager.cls');
      await executeCommandWithCommandPalette(page, 'SFDX: Create OpenAPI Document from This Class');
    } else {
      await executeExplorerContextMenuCommand(page, 'CaseManager.cls', 'SFDX: Create OpenAPI Document from This Class');
    }
    await confirmEsrFolderPrompt(page);
    await waitForEsrFile(workspaceDir, 'CaseManager');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
