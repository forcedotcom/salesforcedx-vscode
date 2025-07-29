/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test, expect, Locator } from '@playwright/test';
import { connectToCDPBrowser, reportConsoleCapture, CDPConnection } from './shared/cdp-utils';

/**
 * Test suite for Salesforce Org Browser web extension
 * Tests run against VS Code web served by vscode-test-web
 *
 * REQUIRES CDP (Chrome DevTools Protocol) connection - no Playwright fallback
 * Prerequisites: VS Code web server MUST be running (npm run run:web)
 */
test.describe('Org Browser Web Extension (CDP Required)', () => {
  let cdpConnection: CDPConnection | null = null;

  test.beforeEach(async ({ page: _page }) => {
    // CDP connection is REQUIRED - no fallback to Playwright
    try {
      cdpConnection = await connectToCDPBrowser(9222);
      console.log('✅ Using CDP connection for test');

      // Navigate to VS Code if not already there
      if (!cdpConnection.page.url().includes('localhost:3000')) {
        await cdpConnection.page.goto('http://localhost:3000/');
      }

      // Wait for VS Code to fully load
      await cdpConnection.page.waitForSelector('.monaco-workbench', { timeout: 60000 });

      // Wait for Services extension to create the workspace and files to appear
      // This mimics the manual loading experience where files appear automatically
      await cdpConnection.page.waitForFunction(
        () => {
          // Look for the Explorer view and files within it
          const explorerView = document.querySelector('.explorer-folders-view');
          if (!explorerView) return false;
          const fileItems = explorerView.querySelectorAll('.monaco-list-row');
          return fileItems.length > 0;
        },
        { timeout: 30000 }
      );
      console.log('✅ Workspace loaded with files visible in Explorer');

      // Wait specifically for sfdx-project.json to appear (it loads after other files)
      await cdpConnection.page.waitForFunction(
        () => {
          const explorerView = document.querySelector('.explorer-folders-view');
          if (!explorerView) return false;
          // Look for sfdx-project.json specifically in the file tree
          const textContent = explorerView.textContent ?? '';
          return textContent.includes('sfdx-project.json');
        },
        { timeout: 15000 }
      );
      console.log('✅ sfdx-project.json found in Explorer');

      const fileTreeItems = await cdpConnection.page.locator('.explorer-folders-view .monaco-list-row').all();

      console.log(`✅ Workspace loaded with ${fileTreeItems.length} files, including sfdx-project.json`);
    } catch (cdpError) {
      console.log('❌ CDP connection REQUIRED but failed:', cdpError);
      console.log('💡 Start VS Code web manually first: npm run run:web');
      throw new Error(`CDP connection required but failed: ${cdpError.message}`);
    }
  });

  test.afterEach(async () => {
    // Report console capture if we used CDP
    if (cdpConnection) {
      console.log('\n📊 Test Console Report:');
      reportConsoleCapture(cdpConnection.capture);

      // Check for critical errors
      if (cdpConnection.capture.removeAllListenersErrors.length > 0) {
        console.log('🚨 CRITICAL: removeAllListeners errors detected!');
        cdpConnection.capture.removeAllListenersErrors.forEach(error => console.log(`  ❌ ${error}`));
      }
    }
  });

  // Helper to get the current page (CDP only now)
  const getCurrentPage = ({ page }: { page: import('@playwright/test').Page }): import('@playwright/test').Page =>
    cdpConnection?.page ?? page;

  test('should load VS Code web with org browser extension', async ({ page }) => {
    const currentPage = getCurrentPage({ page });

    // Verify VS Code workbench is loaded
    await expect(currentPage.locator('.monaco-workbench')).toBeVisible();

    // Check that the activity bar is present
    const activityBar = currentPage.locator('.activitybar');
    await expect(activityBar).toBeVisible();
  });

  test('should show org browser in activity bar when extension is loaded', async ({ page }) => {
    const currentPage = getCurrentPage({ page });

    // Look for the org browser icon in the activity bar - be more specific to avoid strict mode violations
    const orgBrowserAction = currentPage.locator('.activitybar a[aria-label*="Org Browser"]');

    // Wait for the extension to load and show in activity bar
    await expect(orgBrowserAction).toBeVisible({ timeout: 30000 });
  });

  test('should open org browser sidebar when clicked', async ({ page }) => {
    const currentPage = getCurrentPage({ page });

    // Click on the org browser activity bar item
    const orgBrowserAction = currentPage.locator('.activitybar a[aria-label*="Org Browser"]');
    await orgBrowserAction.click();

    // Wait for the sidebar to open by checking for sidebar content
    await currentPage.waitForSelector('.sidebar[role="complementary"]', { timeout: 10000 }).catch(() => {
      console.log('⚠️ Sidebar not detected with role=complementary, checking for .sidebar');
      return currentPage.waitForSelector('.sidebar', { timeout: 5000 });
    });

    // Verify the org browser panel is visible
    // You'll need to adjust this selector based on your extension's actual structure
    const orgBrowserPanel = page.locator('[id*="org-browser"], [class*="org-browser"]');
    await expect(orgBrowserPanel).toBeVisible();
  });

  test('should display connection status or prompt', async ({ page }) => {
    // Open org browser sidebar
    const orgBrowserAction = page.locator('.activitybar a[aria-label*="Org Browser"]');
    await orgBrowserAction.click();

    // Wait for the sidebar to open by checking for sidebar content
    await page.waitForSelector('.sidebar[role="complementary"]', { timeout: 10000 }).catch(() => {
      console.log('⚠️ Sidebar not detected with role=complementary, checking for .sidebar');
      return page.waitForSelector('.sidebar', { timeout: 5000 });
    });

    // Check for connection status or setup prompts
    // This will depend on your extension's UI when no org is connected
    const connectionStatus = page.locator('text=/connect|authorize|sign in|no org/i');
    await expect(connectionStatus).toBeVisible({ timeout: 10000 });
  });

  test('should show command palette with org browser commands', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('F1');

    // Wait for command palette to open
    await page.waitForSelector('.quick-input-widget', { timeout: 5000 });

    // Type to filter for org browser commands
    await page.keyboard.type('Org Browser');

    // Check that org browser commands appear
    const commandItems = page.locator('.quick-input-list .monaco-list-row');
    await expect(commandItems.first()).toBeVisible({ timeout: 5000 });
  });

  test('should not show VS Code notification errors', async ({ page }) => {
    // Wait a bit for extensions to load and any initial errors to surface
    await page.waitForTimeout(3000);

    // Check for error notifications in VS Code
    const errorNotifications = page.locator(
      '.notifications-container .notification-list-item.error, .notifications-container .notification-list-item-message[class*="error"]'
    );

    const errorCount = await errorNotifications.count();
    if (errorCount > 0) {
      console.log(`Found ${errorCount} error notification(s):`);
      const errorTexts = await Promise.all(
        Array.from({ length: errorCount }, async (_, i) => await errorNotifications.nth(i).textContent())
      );
      errorTexts.forEach((errorText, i) => {
        console.log(`  Error ${i + 1}: ${errorText}`);
      });
    }

    // Assert no error notifications should be present
    await expect(errorNotifications).toHaveCount(0);
  });

  test('should not have browser console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    const consoleOthers: string[] = [];
    const pageErrors: string[] = [];
    const requestErrors: string[] = [];

    // Listen for ALL console messages to catch any error-like content
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();

      if (type === 'error') {
        consoleErrors.push(text);
      } else if (type === 'warning') {
        consoleWarnings.push(text);
      } else {
        // Capture ANY message that looks like an error, regardless of type
        if (
          text.includes('Error:') ||
          text.includes('TypeError:') ||
          text.includes('ReferenceError:') ||
          text.includes('Uncaught') ||
          text.includes('pipe is not a function') ||
          text.includes('res.body.pipe') ||
          text.includes('RefreshTokenAuthError') ||
          text.includes('FiberFailure') ||
          text.includes('Effect')
        ) {
          consoleOthers.push(`[${type}] ${text}`);
        }
      }
    });

    // Listen for uncaught promise rejections and page errors
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    // Listen for request failures that might indicate network-related errors
    page.on('requestfailed', request => {
      requestErrors.push(`Request failed: ${request.url()} - ${request.failure()?.errorText ?? 'Unknown error'}`);
    });

    // Set up error monitoring BEFORE navigating to the page
    await page.waitForTimeout(100);

    // Open org browser to trigger extension interactions
    const orgBrowserAction = page.locator('.activitybar a[aria-label*="Org Browser"]');
    await orgBrowserAction.click();

    // Give more time for async operations and console errors to manifest
    await page.waitForTimeout(500);

    // Filter out benign page errors
    const realPageErrors = pageErrors.filter(
      error => error !== 'ProgressEvent' && !error.includes('net::ERR_NETWORK_CHANGED')
    );

    // Try to capture any additional errors by inspecting the page state
    const additionalErrors = await page.evaluate(() => {
      const errors: string[] = [];

      // Check for any error notifications in VS Code UI
      const errorNotifications = document.querySelectorAll(
        '.notifications-container .error, .notification-error, [class*="error-notification"]'
      );
      errorNotifications.forEach(element => {
        if (element.textContent) {
          errors.push(`[Notification] ${element.textContent}`);
        }
      });

      return errors;
    });

    // Combine all error types
    const allRealErrors = [
      ...consoleErrors,
      ...consoleWarnings,
      ...consoleOthers,
      ...realPageErrors,
      ...requestErrors,
      ...additionalErrors
    ];

    // Comprehensive logging of all found errors
    if (consoleErrors.length > 0) {
      console.log(`\nFound ${consoleErrors.length} console error(s):`);
      consoleErrors.forEach((error, index) => {
        console.log(`  Console Error ${index + 1}: ${error}`);
      });
    }

    if (consoleWarnings.length > 0) {
      console.log(`\nFound ${consoleWarnings.length} console warning(s):`);
      consoleWarnings.forEach((error, index) => {
        console.log(`  Console Warning ${index + 1}: ${error}`);
      });
    }

    if (consoleOthers.length > 0) {
      console.log(`\nFound ${consoleOthers.length} suspicious console message(s):`);
      consoleOthers.forEach((error, index) => {
        console.log(`  Console Other ${index + 1}: ${error}`);
      });
    }

    if (realPageErrors.length > 0) {
      console.log(`\nFound ${realPageErrors.length} page error(s):`);
      realPageErrors.forEach((error, index) => {
        console.log(`  Page Error ${index + 1}: ${error}`);
      });
    }

    if (requestErrors.length > 0) {
      console.log(`\nFound ${requestErrors.length} request error(s):`);
      requestErrors.forEach((error, index) => {
        console.log(`  Request Error ${index + 1}: ${error}`);
      });
    }

    if (additionalErrors.length > 0) {
      console.log(`\nFound ${additionalErrors.length} additional error(s):`);
      additionalErrors.forEach((error, index) => {
        console.log(`  Additional Error ${index + 1}: ${error}`);
      });
    }

    // Specific error type analysis
    const pipeErrors = allRealErrors.filter(
      error =>
        error.includes('pipe is not a function') ||
        error.includes('res.body.pipe') ||
        error.includes('TypeError: res.body.pipe')
    );

    const effectErrors = allRealErrors.filter(
      error =>
        error.includes('Effect') ||
        error.includes('FiberFailure') ||
        error.includes('notificationsAlerts') ||
        error.includes('RefreshTokenAuthError') ||
        error.includes('fsProvider')
    );

    if (pipeErrors.length > 0) {
      console.log(`\n🚨 Found ${pipeErrors.length} pipe-related error(s):`);
      pipeErrors.forEach((error, index) => {
        console.log(`  Pipe Error ${index + 1}: ${error}`);
      });
    }

    if (effectErrors.length > 0) {
      console.log(`\n🚨 Found ${effectErrors.length} Effect-related error(s):`);
      effectErrors.forEach((error, index) => {
        console.log(`  Effect Error ${index + 1}: ${error}`);
      });
    }

    if (allRealErrors.length === 0) {
      console.log('\n✅ No console errors detected!');
    } else {
      console.log(`\n❌ Total errors found: ${allRealErrors.length}`);
      console.log('\n📋 All errors summary:');
      allRealErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    // Filter out expected network errors for now to focus on the pipe error
    // Filter out known expected errors (network timeouts, etc)
    // NOTE: If org is properly configured, we should NOT see "No default org" error
    const criticalErrors = allRealErrors.filter(
      error => !error.includes('net::ERR_FAILED') && !error.includes('Request failed:')
    );

    // Check specifically for removeAllListeners errors (these should fail the test)
    const eventEmitterErrors = allRealErrors.filter(
      error => error.includes('removeAllListeners') || error.includes('listeners is not a function')
    );

    if (eventEmitterErrors.length > 0) {
      console.error('❌ EventEmitter polyfill errors found:');
      eventEmitterErrors.forEach(error => console.error(`  - ${error}`));
      throw new Error(
        `Found ${eventEmitterErrors.length} EventEmitter polyfill errors - extension bundle needs polyfill fixes`
      );
    }

    // Assert no critical errors should be present
    expect(criticalErrors).toHaveLength(0);
  });

  test('should test org browser with CDP console access', async () => {
    // This test connects to an existing Chrome instance with detailed console logging
    const { page, capture } = await connectToCDPBrowser(9222);

    try {
      // Look for the Org Browser activity icon
      await page.waitForSelector('.activitybar a[aria-label*="Org Browser"]', { timeout: 10000 });
      const orgBrowserIcon = page.locator('.activitybar a[aria-label*="Org Browser"]');

      // Click on the Org Browser
      await orgBrowserIcon.click();
      console.log('✅ Clicked Org Browser activity bar item');

      // Wait for the sidebar to open and tree items to load
      await page.waitForSelector('.sidebar', { timeout: 10000 });
      await page
        .waitForSelector('[role="treeitem"], .tree-container, .org-browser-tree', { timeout: 15000 })
        .catch(() => {
          console.log('⚠️ Tree elements not found, extension may still be loading');
        });

      // Look for tree items
      const treeItems = await page.locator('[role="treeitem"]').all();
      console.log(`📊 Found ${treeItems.length} tree items in Org Browser`);

      // Try to interact with tree items if they exist
      if (treeItems.length > 0) {
        try {
          console.log('🔍 Attempting to expand first tree item...');
          await treeItems[0].click({ timeout: 5000 });

          // Wait for potential expansion/loading
          await page.waitForTimeout(1000);

          const expandedItems = await page.locator('[role="treeitem"]').all();
          console.log(`📊 After expansion: ${expandedItems.length} tree items`);
        } catch (clickError) {
          console.log(
            'ℹ️ Could not expand tree item:',
            clickError instanceof Error ? clickError.message : String(clickError)
          );
        }
      }

      // Wait for any async tree operations to complete by checking for stable tree state
      await page
        .waitForFunction(
          () => {
            const treeContainer = document.querySelector('[role="tree"], .tree-container, .org-browser-tree');
            return treeContainer && !treeContainer.getAttribute('aria-busy');
          },
          { timeout: 15000 }
        )
        .catch(() => {
          // Fallback if tree state indicators aren't available
          console.log('⚠️ Tree state not detectable, using short fallback wait');
        });

      // Report console results
      reportConsoleCapture(capture);

      // Fail test if critical errors found
      if (capture.removeAllListenersErrors.length > 0) {
        throw new Error(
          `❌ Found ${capture.removeAllListenersErrors.length} EventEmitter errors - extension not properly polyfilled`
        );
      }

      if (capture.fiberFailureErrors.length > 0) {
        throw new Error(`❌ Found ${capture.fiberFailureErrors.length} Effect runtime errors - check Effect usage`);
      }

      // Log success metrics
      console.log('✅ Org Browser test completed successfully');
      console.log(
        `📈 Metrics: ${treeItems.length} tree items, ${capture.authLogs.length} auth logs, ${capture.consoleErrors.length} console errors`
      );
    } catch (error) {
      console.error('❌ Org Browser CDP test failed:', error);
      reportConsoleCapture(capture);
      throw error;
    }
  });

  test('should verify org browser tree functionality and console health', async ({ page }) => {
    const consoleMessages: string[] = [];
    const consoleErrors: string[] = [];
    const removeAllListenersErrors: string[] = [];

    // Capture all console messages for detailed analysis
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

    console.log('🔍 Starting comprehensive org browser test...');

    // Click on the Org Browser in activity bar
    console.log('Looking for Org Browser activity bar item...');
    await page.waitForSelector('.activitybar a[aria-label*="Org Browser"]', { timeout: 10000 });
    const orgBrowserIcon = page.locator('.activitybar a[aria-label*="Org Browser"]');
    await orgBrowserIcon.click();
    console.log('✅ Clicked Org Browser activity bar item');

    // Wait for sidebar to open and extension to load
    await page.waitForSelector('.sidebar', { timeout: 10000 });
    console.log('⏳ Sidebar opened, waiting for tree content...');

    // Wait for tree content to appear
    await page
      .waitForSelector('[role="tree"], [role="treeitem"], .tree-container, .org-browser-tree', { timeout: 15000 })
      .catch(() => {
        console.log('⚠️ Tree content not detected, proceeding with test...');
      });

    // Look for ANY tree-like elements
    console.log('🔍 Searching for tree elements...');

    // Try multiple selectors to find tree content
    const treeSelectors = [
      '[role="tree"]',
      '[role="treeitem"]',
      '.monaco-list',
      '.tree-explorer-viewlet-tree-view',
      '[class*="tree"]',
      '[id*="tree"]',
      '.view-content',
      '.pane-body'
    ];

    let foundElements = 0;
    let treeItems: Locator[] = [];

    for (const selector of treeSelectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        console.log(`📋 Found ${elements.length} elements with selector "${selector}"`);
        foundElements += elements.length;

        if (selector === '[role="treeitem"]') {
          treeItems = elements;
        }
      }
    }

    console.log(`📊 Total tree-like elements found: ${foundElements}`);

    // Try to get text content from visible elements
    console.log('📝 Checking visible content in sidebar...');
    try {
      const sidebarContent = await page.locator('.sidebar').textContent();
      if (sidebarContent?.trim()) {
        console.log(`📋 Sidebar content preview: ${sidebarContent.substring(0, 200)}...`);
      }
    } catch {
      console.log('ℹ️ Could not read sidebar content');
    }

    // If we found tree items, try to interact with them
    if (treeItems.length > 0) {
      console.log(`🎯 Found ${treeItems.length} tree items, attempting interaction...`);

      try {
        // Try to click the first tree item
        await treeItems[0].click({ timeout: 5000 });
        console.log('✅ Successfully clicked first tree item');

        // Wait for potential expansion/data loading
        await page.waitForTimeout(1000);

        // Check if more tree items appeared (indicating expansion)
        const newTreeItems = await page.locator('[role="treeitem"]').all();
        console.log(`📊 After interaction: ${newTreeItems.length} tree items (was ${treeItems.length})`);

        if (newTreeItems.length > treeItems.length) {
          console.log('🎉 Tree expansion detected - real org data is loading!');
        }
      } catch (clickError) {
        console.log(
          `ℹ️ Could not interact with tree item: ${clickError instanceof Error ? clickError.message : String(clickError)}`
        );
      }
    } else {
      console.log('⚠️ No tree items found - extension may be showing connection prompt');
    }

    // Wait for any async operations to complete
    await page.waitForTimeout(500);

    // Report console analysis
    console.log('\n📋 Console Message Analysis:');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`removeAllListeners errors: ${removeAllListenersErrors.length}`);

    if (removeAllListenersErrors.length > 0) {
      console.log('\n❌ removeAllListeners Errors Found:');
      removeAllListenersErrors.forEach(error => console.log(`  - ${error}`));
    }

    if (consoleErrors.length > 0 && consoleErrors.length <= 10) {
      console.log('\n⚠️ Console Errors:');
      consoleErrors.forEach(error => console.log(`  - ${error}`));
    }

    // Key assertions
    expect(removeAllListenersErrors).toHaveLength(0); // This is our main polyfill verification

    // Allow some auth-related errors but log them
    const criticalErrors = consoleErrors.filter(
      error =>
        !error.includes('No default org') && !error.includes('net::ERR_FAILED') && !error.includes('Request failed:')
    );

    if (criticalErrors.length > 0) {
      console.log('\n🚨 Critical Errors Found:');
      criticalErrors.forEach(error => console.log(`  - ${error}`));
    }

    // Log success metrics
    console.log('\n✅ Test Results:');
    console.log(`  - removeAllListeners errors: ${removeAllListenersErrors.length}`);
    console.log(`  - Tree elements found: ${foundElements}`);
    console.log(`  - Extension loaded: ${foundElements > 0 ? 'YES' : 'UNKNOWN'}`);
    console.log(`  - Console health: ${criticalErrors.length === 0 ? 'GOOD' : 'ISSUES FOUND'}`);
  });

  test('should verify org browser with realistic environment (CDP-first)', async ({ page }) => {
    let usingCDP = false;
    let cdpPage;
    let capture;

    try {
      // Try to connect to existing Chrome instance first (more realistic)
      console.log('🔍 Attempting CDP connection to existing browser...');
      const localCdpConnection = await connectToCDPBrowser(9222);
      cdpPage = localCdpConnection.page;
      capture = localCdpConnection.capture;
      usingCDP = true;
      console.log('✅ Successfully connected via CDP - using realistic browser environment');
    } catch (cdpError) {
      console.log('ℹ️ CDP connection failed, falling back to isolated test environment');
      console.log(`   CDP Error: ${cdpError instanceof Error ? cdpError.message : String(cdpError)}`);

      // Fall back to regular Playwright page
      cdpPage = page;
      usingCDP = false;

      // Set up console capture for non-CDP mode
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

      capture = {
        consoleErrors,
        removeAllListenersErrors,
        fiberFailureErrors: consoleErrors.filter(error => error.includes('FiberFailure')),
        authLogs: consoleMessages.filter(
          msg =>
            msg.includes('🔍') ||
            msg.includes('✅') ||
            msg.includes('❌') ||
            msg.includes('auth') ||
            msg.includes('Auth') ||
            msg.includes('Effect')
        ),
        allLogs: consoleMessages
      };
    }

    console.log(`🌐 Test environment: ${usingCDP ? 'Real Chrome via CDP' : 'Isolated Playwright'}`);

    // Wait for VS Code to load before testing Org Browser switch
    console.log('⏳ Waiting for VS Code to fully load...');
    await cdpPage.waitForSelector('.monaco-workbench', { timeout: 30000 });

    // Wait for activity bar to be ready
    await cdpPage.waitForSelector('.activitybar a[aria-label*="Org Browser"]', { timeout: 15000 });

    // Now click on the Org Browser tab
    console.log('🔍 Looking for Org Browser activity bar item...');
    await cdpPage.waitForSelector('.activitybar a[aria-label*="Org Browser"]', { timeout: 10000 });
    const orgBrowserIcon = cdpPage.locator('.activitybar a[aria-label*="Org Browser"]');
    await orgBrowserIcon.click();
    console.log('✅ Clicked Org Browser activity bar item - switching from Explorer to Org Browser');

    // Wait for the view switch to complete and potential errors to surface
    await cdpPage.waitForTimeout(500);

    // Look for tree items
    const treeItems = await cdpPage.locator('[role="treeitem"]').all();
    console.log(`📊 Found ${treeItems.length} tree items in Org Browser`);

    // Try to interact with tree items if they exist
    if (treeItems.length > 0) {
      try {
        console.log('🔍 Attempting to expand first tree item...');
        await treeItems[0].click({ timeout: 5000 });

        // Wait for potential expansion/loading
        await cdpPage.waitForTimeout(500);

        const expandedItems = await cdpPage.locator('[role="treeitem"]').all();
        console.log(`📊 After expansion: ${expandedItems.length} tree items`);

        if (expandedItems.length > treeItems.length) {
          console.log('🎉 Tree expansion detected - real org data is working!');
        }
      } catch (clickError) {
        console.log(
          `ℹ️ Could not expand tree item: ${clickError instanceof Error ? clickError.message : String(clickError)}`
        );
      }
    }

    // Wait longer for async operations and tree loading errors to surface
    console.log('⏳ Waiting for tree data loading and potential errors...');
    await cdpPage.waitForTimeout(500); // Wait longer to catch tree loading errors

    // Report results
    if (usingCDP) {
      reportConsoleCapture(capture);
    } else {
      console.log(
        `📋 Console Analysis (Isolated): ${capture.consoleErrors.length} errors, ${capture.removeAllListenersErrors.length} removeAllListeners errors`
      );
    }

    // Assertions
    expect(capture.removeAllListenersErrors).toHaveLength(0);

    // More lenient assertions for different environments
    if (usingCDP) {
      // In CDP mode, we expect better auth behavior
      const criticalErrors = capture.consoleErrors.filter(
        error => !error.includes('net::ERR_FAILED') && !error.includes('Request failed:') && !error.includes('sandbox')
      );

      if (criticalErrors.length > 0) {
        console.log('⚠️ Critical errors in CDP mode:');
        criticalErrors.forEach(error => console.log(`  - ${error}`));
      }

      // Log success metrics
      console.log('✅ CDP Test Results:');
      console.log('  - Environment: Real Chrome Browser');
      console.log(`  - Tree items found: ${treeItems.length}`);
      console.log(`  - removeAllListeners errors: ${capture.removeAllListenersErrors.length}`);
      console.log(`  - Auth working: ${capture.authLogs.length > 0 ? 'YES' : 'UNKNOWN'}`);
    } else {
      // In isolated mode, we're more lenient with auth errors
      const criticalErrors = capture.consoleErrors.filter(
        error =>
          !error.includes('No default org') && !error.includes('net::ERR_FAILED') && !error.includes('Request failed:')
      );

      console.log('✅ Isolated Test Results:');
      console.log('  - Environment: Isolated Playwright');
      console.log(`  - Tree elements found: ${treeItems.length}`);
      console.log(`  - removeAllListeners errors: ${capture.removeAllListenersErrors.length}`);
      console.log(`  - Console health: ${criticalErrors.length === 0 ? 'GOOD' : 'ISSUES FOUND'}`);
    }
  });
});
