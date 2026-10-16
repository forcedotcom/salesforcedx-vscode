/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { open, type GalleryExtension } from '@vscode/test-web';
import * as path from 'node:path';
import { resolveRepoRoot } from '../utils/repoRoot';

type HeadlessServerOptions = {
  /** Extension name for logging (e.g., "Org Browser", "Metadata") */
  extensionName: string;
  /** The __dirname from the calling headlessServer.ts file (used to resolve extension paths) */
  callerDirname: string;
  /** Additional extension directory names to load (services is always included automatically) */
  additionalExtensionDirs?: string[];
  /**
   * Marketplace extensions (`publisher.name`) passed to `@vscode/test-web` `open()` as `extensionIds`.
   * Unversioned ids install the current gallery release.
   */
  extensionIds?: readonly GalleryExtension[];
  /**
   * Omit the caller's package as `extensionDevelopmentPath` so it does not activate.
   * Gallery language server under test belongs in {@link extensionIds}.
   */
  skipExtensionDevelopmentPath?: boolean;
  /**
   * Local folder to mount as the VS Code Web workspace (`vscode-test-web://mount`).
   * Use with {@link createTestWorkspace} so tests see `sfdx-project.json` and project files.
   *
   * Prefer {@link folderUri} when extensions must resolve the project with Node `fs`
   * (e.g. `@salesforce/core` `SfProject`): `folderPath` is always a virtual FS, so CLI-style
   * resolution does not see real disk files.
   */
  folderPath?: string;
  /**
   * Workspace folder URI (e.g. `file:///var/.../project`). Use for E2E that need a **file** workspace
   * so `SfProject` / `sf:project_opened` work; omit both this and `folderPath` for the default test
   * workspace.
   */
  folderUri?: string;
};

/** Creates and starts a headless VS Code web server for testing an extension with services */
export const createHeadlessServer = async (options: HeadlessServerOptions): Promise<void> => {
  try {
    // callerDirname is '<pkg>/test/playwright/web' (tsx) -> go up three levels to '<pkg>'
    const packageRoot = path.resolve(options.callerDirname, '..', '..', '..');
    const extensionDevelopmentPath = options.skipExtensionDevelopmentPath ? undefined : packageRoot;

    // Collect all extension paths: services + any additional
    const extensionPaths = (options.additionalExtensionDirs ?? [])
      .concat(['salesforcedx-vscode-services'])
      .map(dir => path.resolve(packageRoot, '..', dir));
    console.log(`🌐 Starting VS Code Web (headless) for ${options.extensionName} tests...`);
    if (extensionDevelopmentPath !== undefined) {
      console.log(`📁 Extension path: ${extensionDevelopmentPath}`);
    }
    console.log(`📦 Extension paths: ${extensionPaths.join(', ')}`);
    if (options.extensionIds !== undefined) {
      console.log(`🏪 Marketplace extensions: ${options.extensionIds.map(extension => extension.id).join(', ')}`);
    }
    if (options.folderPath !== undefined) {
      console.log(`📂 Workspace folderPath (virtual mount): ${options.folderPath}`);
    }
    if (options.folderUri !== undefined) {
      console.log(`📂 Workspace folderUri: ${options.folderUri}`);
    }

    const repoRoot = resolveRepoRoot(options.callerDirname);
    const testRunnerDataDir = path.join(repoRoot, '.vscode-test-web');

    // Do not launch Chromium via @vscode/test-web — Playwright's test runner is the only browser client.
    // If browserType is chromium, test-web opens its own browser; when that browser's last page closes, it calls
    // server.close() (see @vscode/test-web open() → context.once('close', …)), killing port 3001 mid-run.
    await open({
      browserType: 'none',
      quality: 'stable',
      commit: process.env.PLAYWRIGHT_WEB_VSCODE_COMMIT,
      port: Number(process.env.PORT) || 3001,
      printServerLog: true,
      verbose: true,
      ...(extensionDevelopmentPath !== undefined ? { extensionDevelopmentPath } : {}),
      extensionPaths,
      ...(options.extensionIds !== undefined ? { extensionIds: [...options.extensionIds] } : {}),
      testRunnerDataDir,
      ...(options.folderUri !== undefined ? { folderUri: options.folderUri } : {}),
      ...(options.folderPath !== undefined ? { folderPath: options.folderPath } : {}),
      browserOptions: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-features=IsolateOrigins,site-per-process',
        ...(process.env.CI
          ? [
              '--no-sandbox',
              '--disable-dev-shm-usage',
              '--disable-background-timer-throttling',
              '--disable-backgrounding-occluded-windows',
              '--disable-renderer-backgrounding'
            ]
          : [])
      ]
    });
  } catch (error) {
    console.error('❌ Failed to start headless server:', error);
    process.exit(1);
  }
};

/** Sets up signal handlers for graceful shutdown */
export const setupSignalHandlers = (): void => {
  const shutdown = (): void => {
    console.log('\n🛑 Shutting down headless server...');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};
