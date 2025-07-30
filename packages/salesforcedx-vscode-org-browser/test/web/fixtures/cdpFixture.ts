/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test as base, Page } from '@playwright/test';
import { connectToCDPBrowser, CDPConnection, reportConsoleCapture } from '../shared/cdpUtils';
import { OrgBrowserPage } from '../pages/orgBrowserPage';

// Define the fixture interface
export type CDPFixtures = {
  cdpConnection: CDPConnection;
  cdpPage: Page; // The page from CDP connection
};

// Define test configuration options
export type TestConfig = {
  requireCustomObject: boolean;
  screenshotOnFailure: boolean;
  timeouts: {
    vsCodeLoad: number;
    activityBar: number;
    sidebar: number;
    treeItems: number;
  };
};

// Define the OrgBrowser fixtures
export type OrgBrowserFixtures = {
  orgBrowserPage: OrgBrowserPage;
  testConfig: TestConfig;
} & CDPFixtures;

// Create the extended test with fixtures
export const test = base.extend<OrgBrowserFixtures>({
  // Define the cdpConnection fixture
  cdpConnection: async ({ page }, use) => {
    let connection: CDPConnection;

    try {
      // Try to connect to existing Chrome instance
      console.log('🔍 Attempting CDP connection to existing browser...');
      connection = await connectToCDPBrowser(9222);
      console.log('✅ Successfully connected via CDP - using realistic browser environment');

      // Navigate to VS Code if not already there
      if (!connection.page.url().includes('localhost:3000')) {
        await connection.page.goto('http://localhost:3000/');
      }

      // Wait for VS Code to fully load
      await connection.page.waitForSelector('.monaco-workbench', { timeout: 60000 });
      console.log('✅ VS Code workbench loaded');

      // Wait a moment to let VS Code stabilize
      await connection.page.waitForTimeout(2000);
      console.log('✅ VS Code ready for testing');
    } catch (cdpError) {
      console.log('❌ CDP connection failed, falling back to isolated test environment');
      console.log(`   CDP Error: ${cdpError instanceof Error ? cdpError.message : String(cdpError)}`);

      // Create a fallback "connection" with the regular Playwright page
      const consoleMessages: string[] = [];
      const consoleErrors: string[] = [];
      const removeAllListenersErrors: string[] = [];

      page.on('console', msg => {
        const text = msg.text();
        consoleMessages.push(`[${msg.type()}] ${text}`);

        if (msg.type() === 'error' || text.includes('Error:') || text.includes('TypeError')) {
          consoleErrors.push(text);

          if (text.includes('removeAllListeners')) {
            removeAllListenersErrors.push(text);
          }
        }
      });

      // Create a minimal browser and context for the fallback connection
      const browser = await page.context().browser();
      const context = page.context();

      connection = {
        browser: browser!,
        context,
        page,
        capture: {
          consoleErrors,
          removeAllListenersErrors,
          fiberFailureErrors: consoleErrors.filter(error => error.includes('FiberFailure')),
          authLogs: consoleMessages.filter(msg => {
            const authMarkers = ['🔍', '✅', '❌', 'auth', 'Auth', 'Effect'];
            return authMarkers.some(marker => msg.includes(marker));
          }),
          allLogs: consoleMessages
        }
      };

      // Wait for VS Code to fully load
      await page.waitForSelector('.monaco-workbench', { timeout: 30000 });
      console.log('✅ VS Code workbench loaded');
    }

    console.log(`🌐 Test environment: ${connection.page !== page ? 'Real Chrome via CDP' : 'Isolated Playwright'}`);

    // Use the fixture in the test
    await use(connection);

    // Report console capture after the test
    console.log('\n📊 Test Console Report:');
    reportConsoleCapture(connection.capture);

    // Check for critical errors
    if (connection.capture.removeAllListenersErrors.length > 0) {
      console.log('🚨 CRITICAL: removeAllListeners errors detected!');
      connection.capture.removeAllListenersErrors.forEach(error => console.log(`  ❌ ${error}`));
    }
  },

  // Define the cdpPage fixture that depends on cdpConnection
  cdpPage: async ({ cdpConnection }: { cdpConnection: CDPConnection }, use: (page: Page) => Promise<void>) => {
    await use(cdpConnection.page);
  },

  // Define the testConfig fixture
  testConfig: async ({}, use) => {
    // Default configuration
    const config: TestConfig = {
      requireCustomObject: true,
      screenshotOnFailure: true,
      timeouts: {
        vsCodeLoad: 30000,
        activityBar: 15000,
        sidebar: 10000,
        treeItems: 5000
      }
    };

    await use(config);
  },

  // Define the orgBrowserPage fixture
  orgBrowserPage: async ({ cdpPage, testConfig }, use) => {
    // Create the OrgBrowserPage instance
    const orgBrowserPage = new OrgBrowserPage(cdpPage);

    // Use the fixture in the test
    await use(orgBrowserPage);

    // Take a screenshot on failure if configured
    if (testConfig.screenshotOnFailure) {
      // In a real implementation, we would use Playwright's test.info() to check test status
      // Since we don't have access to test status here, we'll rely on the default Playwright screenshots
      // which are already configured in playwright.web.config.ts with screenshot: 'on'
    }
  }
});

// Re-export expect
export { expect } from '@playwright/test';
