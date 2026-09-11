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

const CORE_TELEMETRY_FILE = 'salesforcedx-vscode-core-telemetry.json';

type TelemetryEvent = { command: string; data: Record<string, unknown> };

const readTelemetryEvents = async (workspaceDir: string): Promise<TelemetryEvent[]> => {
  try {
    const raw = await fs.readFile(path.join(workspaceDir, CORE_TELEMETRY_FILE), 'utf-8');
    return JSON.parse(`[${raw.trim().replace(/,\s*$/, '')}]`) as TelemetryEvent[];
  } catch {
    return [];
  }
};

test('Open Documentation: registered command executes for the active editor', async ({ page, workspaceDir }) => {
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

  await test.step('invoke the registered command and observe its telemetry event', async () => {
    await verifyCommandExists(page, packageNls.open_documentation_text, 30_000);
    await executeCommandWithCommandPalette(page, packageNls.open_documentation_text);
    await expect
      .poll(
        async () =>
          (await readTelemetryEvents(workspaceDir)).some(
            event =>
              event.command === 'commandExecution' &&
              event.data.commandName === 'sf.open.documentation' &&
              event.data.type === 'apex'
          ),
        { message: 'sf.open.documentation should emit Apex command telemetry', timeout: 30_000 }
      )
      .toBe(true);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
