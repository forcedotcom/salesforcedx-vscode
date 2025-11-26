/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { open } from '@vscode/test-web';
import * as path from 'node:path';

type HeadlessServerOptions = {
  /** Extension name for logging (e.g., "Org Browser", "Metadata") */
  extensionName: string;
  /** The __dirname from the calling headlessServer.ts file (used to resolve extension paths) */
  callerDirname: string;
};

/** Creates and starts a headless VS Code web server for testing an extension with services */
export const createHeadlessServer = async (options: HeadlessServerOptions): Promise<void> => {
  try {
    // callerDirname is '<pkg>/out/test/playwright/web' → go up four levels to '<pkg>'
    const extensionDevelopmentPath = path.resolve(options.callerDirname, '..', '..', '..', '..');
    const servicesExtensionPath = path.resolve(extensionDevelopmentPath, '..', 'salesforcedx-vscode-services');

    console.log(`🌐 Starting VS Code Web (headless) for ${options.extensionName} tests...`);
    console.log(`📁 Extension path: ${extensionDevelopmentPath}`);
    console.log(`📦 Services extension path: ${servicesExtensionPath}`);

    await open({
      browserType: 'chromium',
      headless: true,
      port: 3001,
      printServerLog: true,
      verbose: true,
      extensionDevelopmentPath,
      extensionPaths: [servicesExtensionPath],
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
