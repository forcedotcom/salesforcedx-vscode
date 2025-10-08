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

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down headless server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down headless server...');
  process.exit(0);
});

if (require.main === module) {
  void startHeadlessServer();
}
