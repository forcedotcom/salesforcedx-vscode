/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is Node.js test infrastructure, not extension code
import type { WorkerFixtures, TestFixtures } from './desktopFixtureTypes';
import { test as base, _electron as electron } from '@playwright/test';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { filterErrors } from '../utils/helpers';
import { createTestWorkspace } from './desktopWorkspace';

type CreateDesktopTestOptions = {
  /** __dirname from the calling extension's fixture file (e.g., '<pkg>/test/playwright/fixtures') */
  fixturesDir: string;
  orgAlias?: string;
};

/** Creates a Playwright test instance configured for desktop Electron testing with services extension */
export const createDesktopTest = ({ fixturesDir, orgAlias }: CreateDesktopTestOptions) => {
  const test = base.extend<TestFixtures, WorkerFixtures>({
    // Download VS Code once per worker (cached in ~/.vscode-test/ or the windows equivalent)
    vscodeExecutable: [
      async ({}, use): Promise<void> => {
        const executablePath = await downloadAndUnzipVSCode();
        await use(executablePath);
      },
      { scope: 'worker' }
    ],

    // Launch fresh Electron instance per test
    electronApp: async ({ vscodeExecutable }, use): Promise<void> => {
      const workspaceDir = await createTestWorkspace(orgAlias);
      // Use subdirectory of workspace for user data (keeps everything isolated and together)
      const userDataDir = path.join(workspaceDir, '.vscode-test-user-data');
      await fs.mkdir(userDataDir, { recursive: true });
      // Isolate extensions directory as well (to avoid parallel install conflicts)
      const extensionsDir = path.join(workspaceDir, '.vscode-test-extensions');
      await fs.mkdir(extensionsDir, { recursive: true });

      // fixturesDir is '<pkg>/test/playwright/fixtures' → go up three levels to '<pkg>'
      const packageRoot = path.resolve(fixturesDir, '..', '..', '..');
      // Extension path is the package root (contains package.json and bundled dist/index.js)
      const extensionPath = packageRoot;
      const servicesPath = path.resolve(packageRoot, '..', 'salesforcedx-vscode-services');

      // Video directory for this test
      const videosDir = path.join(packageRoot, 'test-results', 'videos');
      await fs.mkdir(videosDir, { recursive: true });

      const electronApp = await electron.launch({
        executablePath: vscodeExecutable,
        args: [
          // Unique user data directory for parallel test isolation
          `--user-data-dir=${userDataDir}`,
          // Unique extensions directory to avoid parallel install conflicts
          `--extensions-dir=${extensionsDir}`,
          // Load both extensions (current extension depends on services)
          `--extensionDevelopmentPath=${extensionPath}`,
          `--extensionDevelopmentPath=${servicesPath}`,
          '--disable-extensions', // Disable other extensions
          '--disable-workspace-trust', // Skip workspace trust modal
          '--no-sandbox', // Disable sandbox for file system access (needed for SF CLI auth files)

          workspaceDir
        ],

        env: { ...process.env, VSCODE_DESKTOP: '1' } as Record<string, string>,
        timeout: 60_000,
        recordVideo: {
          dir: videosDir,
          size: { width: 1920, height: 1080 }
        }
      });

      try {
        await use(electronApp);
      } finally {
        // Ensure cleanup happens even if test fails
        try {
          await electronApp.close();
        } catch {}
      }
    },

    // Get first window from Electron app
    page: async ({ electronApp }, use) => {
      const page = await electronApp.firstWindow();

      // Capture console logs (especially errors) for debugging
      page.on('console', msg => {
        if (
          msg.type() !== 'error' ||
          filterErrors([{ text: msg.text(), url: msg.location()?.url || '' }]).length === 0
        ) {
          return;
        }
        console.log(`[Electron Console Error] ${msg.text()}`);
        // Also log the location if available
        const { url, lineNumber } = msg.location() ?? {};
        if (url) {
          console.log(`  at ${url}:${lineNumber}`);
        }
      });

      const { WORKBENCH } = await import('../utils/locators.js');
      await page.waitForSelector(WORKBENCH, { timeout: 60_000 });
      await use(page);
    }
  });
  test.afterEach(async ({ page }, testInfo) => {
    if (process.env.DEBUG_MODE && testInfo.status !== 'passed') {
      console.log('\n🔍 DEBUG_MODE: Test failed - pausing to keep VS Code window open.');
      console.log('Press Resume in Playwright Inspector or close VS Code window to continue.');
      await page.pause();
    }
  });
  return test;
};
