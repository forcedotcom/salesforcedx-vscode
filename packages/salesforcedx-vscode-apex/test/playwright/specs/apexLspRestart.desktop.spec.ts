/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  openFileByName,
  removePathsInContainer,
  resetContainerWorkbench,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { isContainer, sharedWorkspaceDirTest as test } from '../fixtures';
import { findReleaseDir, triggerLspRestart, waitForApexLspReady } from '../utils/apexLspUtils';
import { openApexFileFromExplorerTree } from '../utils/containerApexLspUtils';

/*
 * Container-only: the container name and the CONTAINER side of the fixture bind mount, published by
 * the orchestrator (scripts/codeBuilderLocalE2E.ts). In the container `workspaceDir` is the HOST side
 * of that mount, so the StandardApexLibrary existence checks read it directly; but the library is
 * owned by the container's `codebuilder` user, so the clean-db delete runs inside the container.
 */
const containerName = process.env.CB_CONTAINER_NAME;
const fixtureContainerDir = process.env.CB_FIXTURE_CONTAINER_DIR;

const removeStandardApexLibrary = async (workspaceDir: string, release: string): Promise<void> => {
  if (!isContainer) {
    await fs.rm(path.join(workspaceDir, '.sfdx', 'tools', release, 'StandardApexLibrary'), {
      recursive: true,
      force: true
    });
    return;
  }
  if (!containerName || !fixtureContainerDir) {
    throw new Error(
      'CB_CONTAINER_NAME / CB_FIXTURE_CONTAINER_DIR is not set — the orchestrator ' +
        '(scripts/codeBuilderLocalE2E.ts) must publish them so the clean-db entries can delete inside the container.'
    );
  }
  removePathsInContainer(containerName, [
    path.posix.join(fixtureContainerDir, '.sfdx', 'tools', release, 'StandardApexLibrary')
  ]);
};

// Desktop: each matrix entry gets its own test-scoped workspace + Electron, so they're already isolated.
// Container: every entry restarts the same shared LSP. Either way, serial mode skips the remaining
// (slow) restart entries once one fails.
test.describe.configure({ mode: 'serial' });

// Clean-db entries last: in the container they delete and rebuild the shared workspace's
// StandardApexLibrary, so the restart-only entries run against the untouched library first.
const matrix = [
  { cleanDb: false, via: 'palette' as const, label: 'palette × restart only' },
  { cleanDb: false, via: 'statusBar' as const, label: 'status bar × restart only' },
  { cleanDb: true, via: 'palette' as const, label: 'palette × clean db + restart' },
  { cleanDb: true, via: 'statusBar' as const, label: 'status bar × clean db + restart' }
];

test.describe('Apex LSP restart', () => {
  test.beforeEach(async ({ page, workspaceDir }) => {
    if (isContainer) {
      await resetContainerWorkbench(page);
    }
    await (isContainer
      ? openApexFileFromExplorerTree(page, 'ExampleClass.cls', ['force-app', 'main', 'default', 'classes'])
      : openFileByName(page, 'ExampleClass.cls'));
    await waitForApexLspReady(page, workspaceDir);
  });

  for (const { cleanDb, via, label } of matrix) {
    test(label, async ({ page, workspaceDir }) => {
      // timeout comes from playwright.config.desktop.ts / createContainerConfig (both 360_000)
      const consoleErrors = setupConsoleMonitoring(page);
      const networkErrors = setupNetworkMonitoring(page);

      const releaseBefore = findReleaseDir(workspaceDir);
      const stdLibBefore = path.join(workspaceDir, '.sfdx', 'tools', releaseBefore, 'StandardApexLibrary');
      if (cleanDb) {
        await removeStandardApexLibrary(workspaceDir, releaseBefore);
      }
      expect(
        existsSync(stdLibBefore),
        cleanDb
          ? 'StandardApexLibrary should be removed before restart'
          : 'StandardApexLibrary should exist before restart'
      ).toBe(!cleanDb);

      const releaseAfter = await triggerLspRestart(page, workspaceDir, { cleanDb, via, inContainer: isContainer });
      await saveScreenshot(page, `step.restart-${via}-${cleanDb ? 'cleandb' : 'only'}.png`);

      const stdLibAfter = path.join(workspaceDir, '.sfdx', 'tools', releaseAfter, 'StandardApexLibrary');
      // waitForApexLspReady (called from triggerLspRestart) already polls for this — assert here for explicitness.
      expect(
        existsSync(stdLibAfter),
        cleanDb
          ? 'StandardApexLibrary should be re-created after clean restart'
          : 'StandardApexLibrary should exist after restart'
      ).toBe(true);

      await validateNoCriticalErrors(test, consoleErrors, networkErrors);
    });
  }
});
