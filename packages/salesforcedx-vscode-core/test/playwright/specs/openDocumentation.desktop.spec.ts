/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import packageNls from '../../../package.nls.json';
import { noOrgDesktopTest as test } from '../fixtures/desktopFixtures';

test('Open Documentation: registered command is invocable for the active editor', async ({ page, workspaceDir }) => {
  test.setTimeout(60_000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const classesDirectory = path.join(workspaceDir, 'force-app', 'main', 'default', 'classes');
  await fs.mkdir(classesDirectory, { recursive: true });
  await fs.writeFile(path.join(classesDirectory, 'Example.cls'), 'public class Example {}');

  await test.step('activate core and open an Apex file', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    await openFileByName(page, 'Example.cls');
  });

  await test.step('invoke the registered command without a missing-handler error', async () => {
    await verifyCommandExists(page, packageNls.open_documentation_text, 30_000);
    await executeCommandWithCommandPalette(page, packageNls.open_documentation_text);
    const missingHandlerErrors = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /command 'sf\.open\.documentation' not found/i });
    await expect(missingHandlerErrors, 'sf.open.documentation should have a registered handler').toHaveCount(0);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
