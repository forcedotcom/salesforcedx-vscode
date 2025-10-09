/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is Node.js test infrastructure, not extension code
import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { createTestWorkspace } from './desktopWorkspace';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { filterErrors } from '../utils/helpers';

/** Worker-scoped fixtures (shared across tests in same worker) */
type WorkerFixtures = {
  vscodeExecutable: string;
};

/** Test-scoped fixtures (fresh for each test) */
type TestFixtures = {
  electronApp: ElectronApplication;
  page: Page;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Download VS Code once per worker (cached in ~/.vscode-test/)
  vscodeExecutable: [
    async ({}, use): Promise<void> => {
      const executablePath = await downloadAndUnzipVSCode();
      await use(executablePath);
    },
    { scope: 'worker' }
  ],

  // Launch fresh Electron instance per test
  electronApp: async ({ vscodeExecutable }, use): Promise<void> => {
    const workspaceDir = await createTestWorkspace();
    // Use subdirectory of workspace for user data (keeps everything isolated and together)
    const userDataDir = path.join(workspaceDir, '.vscode-test-user-data');
    await fs.mkdir(userDataDir, { recursive: true });
    // Isolate extensions directory as well (to avoid parallel install conflicts)
    const extensionsDir = path.join(workspaceDir, '.vscode-test-extensions');
    await fs.mkdir(extensionsDir, { recursive: true });

    // __dirname at runtime is '<pkg>/test/playwright/fixtures' → go up three levels to '<pkg>'
    const packageRoot = path.resolve(__dirname, '..', '..', '..');
    // Extension path is the package root (contains package.json and bundled dist/index.js)
    const extensionPath = packageRoot;
    const servicesPath = path.resolve(packageRoot, '..', 'salesforcedx-vscode-services');

    const electronApp = await electron.launch({
      executablePath: vscodeExecutable,
      args: [
        // Unique user data directory for parallel test isolation
        `--user-data-dir=${userDataDir}`,
        // Unique extensions directory to avoid parallel install conflicts
        `--extensions-dir=${extensionsDir}`,
        // Load both extensions (org-browser depends on services)
        `--extensionDevelopmentPath=${extensionPath}`,
        `--extensionDevelopmentPath=${servicesPath}`,
        '--disable-extensions', // Disable other extensions
        '--disable-workspace-trust', // Skip workspace trust modal
        '--no-sandbox', // Disable sandbox for file system access (needed for SF CLI auth files)

        workspaceDir
      ],

      env: { ...process.env } as Record<string, string>,
      timeout: 60_000
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
      if (msg.type() !== 'error' || filterErrors([{ text: msg.text(), url: msg.location()?.url || '' }]).length === 0) {
        return;
      }
      console.log(`[Electron Console Error] ${msg.text()}`);
      // Also log the location if available
      const { url, lineNumber } = msg.location() ?? {};
      if (url) {
        console.log(`  at ${url}:${lineNumber}`);
      }
    });

    await page.waitForSelector('.monaco-workbench', { timeout: 60000 });
    await use(page);
  }
});
