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

    // __dirname at runtime is '<pkg>/test/playwright/fixtures' → go up three levels to '<pkg>'
    const packageRoot = path.resolve(__dirname, '..', '..', '..');
    // Extension path is the package root (contains package.json and bundled dist/index.js)
    const extensionPath = packageRoot;
    const servicesPath = path.resolve(packageRoot, '..', 'salesforcedx-vscode-services');

    console.log('[desktopFixtures] extensionPath:', extensionPath);
    console.log('[desktopFixtures] servicesPath:', servicesPath);
    console.log('[desktopFixtures] workspaceDir:', workspaceDir);

    const electronApp = await electron.launch({
      executablePath: vscodeExecutable,
      args: [
        // Load both extensions (org-browser depends on services)
        `--extensionDevelopmentPath=${extensionPath}`,
        `--extensionDevelopmentPath=${servicesPath}`,
        '--disable-extensions', // Disable other extensions
        '--disable-workspace-trust', // Skip workspace trust modal
        '--no-sandbox', // Disable sandbox for file system access (needed for SF CLI auth files)

        workspaceDir
      ],
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      env: { ...process.env } as Record<string, string>,
      timeout: 60_000 // Give VS Code more time to launch
    });

    try {
      await use(electronApp);
    } finally {
      // Ensure cleanup happens even if test fails
      console.log('[desktopFixtures] Closing Electron app...');
      try {
        await electronApp.close();
        console.log('[desktopFixtures] Electron app closed successfully');
      } catch (error) {
        console.error('[desktopFixtures] Error closing Electron app:', error);
      }
    }
  },

  // Get first window from Electron app
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();

    // Capture console logs (especially errors) for debugging
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        const text = msg.text();
        console.log(`[Electron Console ${type}] ${text}`);
        // Also log the location if available
        const location = msg.location();
        if (location?.url) {
          console.log(`  at ${location.url}:${location.lineNumber}`);
        }
        // For AuthInfo errors, try to get more details from args
        if (text.includes('AuthInfo')) {
          const args = msg.args();
          args.forEach(arg => {
            arg
              .jsonValue()
              .then((val: unknown) => {
                if (val && typeof val === 'object') {
                  console.log('[AuthInfo error details]', JSON.stringify(val, null, 2));
                }
              })
              .catch(() => {
                /* ignore */
              });
          });
        }
      }
    });

    await page.waitForSelector('.monaco-workbench', { timeout: 60000 });
    await use(page);
  }
});
