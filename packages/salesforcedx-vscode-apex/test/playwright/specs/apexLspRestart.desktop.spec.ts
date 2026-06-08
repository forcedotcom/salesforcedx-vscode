/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  openFileByName,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { test } from '../fixtures';
import { findReleaseDir, triggerLspRestart, waitForApexLspReady } from '../utils/apexLspUtils';

// Each matrix entry gets its own test-scoped workspace + Electron, so they're already isolated.
// Serial mode is purely to skip the remaining (slow) restart entries once one fails.
test.describe.configure({ mode: 'serial' });

const matrix = [
  { cleanDb: false, via: 'palette' as const, label: 'palette × restart only' },
  { cleanDb: true, via: 'palette' as const, label: 'palette × clean db + restart' },
  { cleanDb: false, via: 'statusBar' as const, label: 'status bar × restart only' },
  { cleanDb: true, via: 'statusBar' as const, label: 'status bar × clean db + restart' }
];

test.describe('Apex LSP restart', () => {
  test.beforeEach(async ({ page, workspaceDir }) => {
    await openFileByName(page, 'ExampleClass.cls');
    await waitForApexLspReady(page, workspaceDir);
  });

  for (const { cleanDb, via, label } of matrix) {
    test(label, async ({ page, workspaceDir }) => {
      // timeout comes from playwright.config.desktop.ts (timeout: 360_000)
      const consoleErrors = setupConsoleMonitoring(page);
      const networkErrors = setupNetworkMonitoring(page);

      if (cleanDb) {
        const releaseBefore = findReleaseDir(workspaceDir);
        const stdLibDir = path.join(workspaceDir, '.sfdx', 'tools', releaseBefore, 'StandardApexLibrary');
        await fs.rm(stdLibDir, { recursive: true, force: true });
        expect(existsSync(stdLibDir), 'StandardApexLibrary should be removed before restart').toBe(false);
      }

      const releaseAfter = await triggerLspRestart(page, workspaceDir, { cleanDb, via });
      await saveScreenshot(page, `step.restart-${via}-${cleanDb ? 'cleandb' : 'only'}.png`);

      if (cleanDb) {
        const stdLibDir = path.join(workspaceDir, '.sfdx', 'tools', releaseAfter, 'StandardApexLibrary');
        // waitForApexLspReady (called from triggerLspRestart) already polls for this — assert here for explicitness.
        expect(existsSync(stdLibDir), 'StandardApexLibrary should be re-created after clean restart').toBe(true);
      }

      await validateNoCriticalErrors(test, consoleErrors, networkErrors);
    });
  }
});
