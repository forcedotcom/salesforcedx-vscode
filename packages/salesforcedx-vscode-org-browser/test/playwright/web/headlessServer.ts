/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';

import { open } from '@vscode/test-web';

const startHeadlessServer = async (): Promise<void> => {
  try {
    // __dirname at runtime is '<pkg>/out/test/playwright/web' → go up four levels to '<pkg>'
    const extensionDevelopmentPath = path.resolve(__dirname, '..', '..', '..', '..');
    const servicesExtensionPath = path.resolve(extensionDevelopmentPath, '..', 'salesforcedx-vscode-services');

    console.log('🌐 Starting VS Code Web (headless) for Org Browser tests...');

    console.log(`📁 Extension path: ${extensionDevelopmentPath}`);

    console.log(`📦 Services extension path: ${servicesExtensionPath}`);

    // Start the server - the open() function starts the server and keeps it running
    // It may not resolve until the process is terminated, which is fine for Playwright's webServer
    // Playwright will detect when the URL is ready (up to 120s timeout)
    const serverPromise = open({
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

    // Handle server promise errors
    serverPromise.catch((error: unknown) => {
      console.error('❌ Server error:', error);
      process.exit(1);
    });

    // Give the server a moment to start before Playwright tries to connect
    // The open() promise will keep the process alive
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('✅ Server startup initiated. Playwright will detect when ready.');
  } catch (error) {
    console.error('❌ Failed to start headless server:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down headless server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down headless server...');
  process.exit(0);
});

if (require.main === module) {
  // Start the server and keep the process alive
  // The open() promise will keep running until the process is terminated
  startHeadlessServer().catch((error: unknown) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}
