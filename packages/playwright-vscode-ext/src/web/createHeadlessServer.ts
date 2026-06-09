/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { open, type GalleryExtension } from '@vscode/test-web';
import * as path from 'node:path';
import { resolveRepoRoot } from '../utils/repoRoot';

export type { GalleryExtension } from '@vscode/test-web';

type HeadlessServerOptions = {
  /** Extension name for logging (e.g., "Org Browser", "Metadata") */
  extensionName: string;
  /** The __dirname from the calling headlessServer.ts file (used to resolve extension paths) */
  callerDirname: string;
  /** Additional extension directory names to load (services is always included automatically) */
  additionalExtensionDirs?: string[];
  /**
   * Gallery extensions to install from the marketplace. Passed directly to `open()`.
   * Use when loading an external extension by publisher.name ID instead of a local dev path.
   */
  extensionIds?: GalleryExtension[];
  /**
   * When true, do NOT compute or pass `extensionDevelopmentPath` to `open()`.
   * Use when the caller's package should NOT be loaded (e.g., to avoid loading jorje
   * when testing against the external TS Apex LS).
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
    const repoRoot = resolveRepoRoot(options.callerDirname);

    // When skipExtensionDevelopmentPath is true, do not load the caller's package
    const extensionDevelopmentPath = options.skipExtensionDevelopmentPath ? undefined : packageRoot;

    // Collect extension paths: resolve from repo root packages/ dir
    const additionalDirs = options.additionalExtensionDirs ?? [];
    const extensionPaths = (
      options.skipExtensionDevelopmentPath ? additionalDirs : additionalDirs.concat(['salesforcedx-vscode-services'])
    ).map(dir => path.resolve(repoRoot, 'packages', dir));

    console.log(`🌐 Starting VS Code Web (headless) for ${options.extensionName} tests...`);
    if (extensionDevelopmentPath !== undefined) {
      console.log(`📁 Extension path: ${extensionDevelopmentPath}`);
    }
    if (extensionPaths.length > 0) {
      console.log(`📦 Extension paths: ${extensionPaths.join(', ')}`);
    }
    if (options.extensionIds !== undefined) {
      console.log(`🏪 Marketplace extensions: ${options.extensionIds.map(e => e.id).join(', ')}`);
    }
    if (options.folderPath !== undefined) {
      console.log(`📂 Workspace folderPath (virtual mount): ${options.folderPath}`);
    }
    if (options.folderUri !== undefined) {
      console.log(`📂 Workspace folderUri: ${options.folderUri}`);
    }

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
      ...(extensionPaths.length > 0 ? { extensionPaths } : {}),
      ...(options.extensionIds !== undefined ? { extensionIds: options.extensionIds } : {}),
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
