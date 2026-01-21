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

    // Flush stdout immediately to ensure logs appear in CI
    console.log('🌐 Starting VS Code Web (headless) for Org Browser tests...');
    process.stdout.write('', () => {}); // Force flush

    console.log(`📁 Extension path: ${extensionDevelopmentPath}`);
    console.log(`📦 Services extension path: ${servicesExtensionPath}`);
    console.log(`🔧 CI environment: ${process.env.CI ? 'yes' : 'no'}`);
    console.log('🌐 Target URL: http://localhost:3001');

    // Start the server - the open() function starts the server and keeps it running
    // We await it to keep the process alive - it will not resolve until the process is terminated
    // Playwright's webServer will detect when the URL is ready (up to 120s timeout)
    console.log('🚀 Calling @vscode/test-web open()...');
    process.stdout.write('', () => {}); // Force flush

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

    // Log that we've initiated the server start
    console.log('✅ Server startup initiated. Waiting for server to be ready...');
    process.stdout.write('', () => {}); // Force flush

    // Handle errors asynchronously
    serverPromise.catch((error: unknown) => {
      console.error('❌ Server error:', error);
      process.exit(1);
    });

    // Await the server - this will keep the process alive
    await serverPromise;
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
    process.stderr.write(String(error), () => {});
    process.exit(1);
  });
}
