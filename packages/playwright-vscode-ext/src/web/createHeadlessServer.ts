/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { open } from '@vscode/test-web';
import * as path from 'node:path';
import { resolveRepoRoot } from '../utils/repoRoot';

type HeadlessServerOptions = {
  /** Extension name for logging (e.g., "Org Browser", "Metadata") */
  extensionName: string;
  /** The __dirname from the calling headlessServer.ts file (used to resolve extension paths) */
  callerDirname: string;
  /** Additional extension directory names to load (services is always included automatically) */
  additionalExtensionDirs?: string[];
};

/** Creates and starts a headless VS Code web server for testing an extension with services */
export const createHeadlessServer = async (options: HeadlessServerOptions): Promise<void> => {
  try {
    // callerDirname is '<pkg>/out/test/playwright/web' -> go up four levels to '<pkg>'
    const extensionDevelopmentPath = path.resolve(options.callerDirname, '..', '..', '..', '..');

    // Collect all extension paths: services + any additional
    const extensionPaths = (options.additionalExtensionDirs ?? [])
      .concat(['salesforcedx-vscode-services'])
      .map(dir => path.resolve(extensionDevelopmentPath, '..', dir));
    console.log(`🌐 Starting VS Code Web (headless) for ${options.extensionName} tests...`);
    console.log(`📁 Extension path: ${extensionDevelopmentPath}`);
    console.log(`📦 Extension paths: ${extensionPaths.join(', ')}`);

    const repoRoot = resolveRepoRoot(options.callerDirname);
    const testRunnerDataDir = path.join(repoRoot, '.vscode-test-web');

    await open({
      browserType: 'chromium',
      headless: true,
      quality: 'stable',
      commit: process.env.PLAYWRIGHT_WEB_VSCODE_COMMIT,
      port: Number(process.env.PORT) || 3001,
      printServerLog: true,
      verbose: true,
      extensionDevelopmentPath,
      extensionPaths,
      testRunnerDataDir,
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
