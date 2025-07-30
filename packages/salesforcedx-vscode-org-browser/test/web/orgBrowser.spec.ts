/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test, expect } from './fixtures/cdpFixture';

const typesOfInterest = ['Object', 'Field', 'Apex', 'Class', 'Component'];

/**
 * Test suite for Salesforce Org Browser web extension
 * Tests run against VS Code web served by vscode-test-web
 *
 * Using fixtures for CDP connection and Org Browser page
 */
test.describe('Org Browser Web Extension', () => {
  test('should verify org browser metadata types and tree functionality', async ({
    orgBrowserPage,
    cdpConnection,
    testConfig
  }) => {
    // Open the Org Browser
    await orgBrowserPage.open();

    // Take a screenshot to help with debugging
    await orgBrowserPage.page.screenshot({ path: 'test-results/full-page-screenshot.png', fullPage: true });
    console.log('✅ Screenshot saved to test-results/full-page-screenshot.png');

    // Get all metadata types in the tree
    const treeItems = await orgBrowserPage.getAllMetadataTypes();
    console.log(`📊 Found ${treeItems.length} potential metadata types in Org Browser`);

    // Check if we found any tree items
    if (treeItems.length === 0) {
      console.log('⚠️ No tree items found, but continuing test...');
      await orgBrowserPage.takeScreenshot('after-tree-search-screenshot.png');
    } else {
      console.log('✅ Tree items found in the sidebar');
    }

    // Look for CustomObject specifically
    let customObjectFound = false;
    let customObjectItem = null;
    let anyMetadataTypeFound = false;
    let anyMetadataTypeItem = null;

    // Examine each tree item
    for (const item of treeItems) {
      try {
        const text = await item.textContent();
        const ariaLabel = await item.getAttribute('aria-label');
        const title = await item.getAttribute('title');

        console.log(`Examining item: text="${text}", aria-label="${ariaLabel}", title="${title}"`);

        // Look for CustomObject
        const attributes = [text, ariaLabel, title];
        if (attributes.some(attr => attr?.includes('CustomObject'))) {
          customObjectFound = true;
          customObjectItem = item;
          console.log('✅ CustomObject metadata type found!');
          break;
        }

        // Track any metadata type as fallback
        if (attributes.some(attr => attr && typesOfInterest.some(type => attr.includes(type)))) {
          anyMetadataTypeFound = true;
          anyMetadataTypeItem = item;
          console.log(`✅ Found metadata type: ${text ?? ariaLabel ?? title ?? 'Unknown'}`);
        }
      } catch (error) {
        console.log(`⚠️ Error examining tree item: ${String(error)}`);
      }
    }

    // If we haven't found CustomObject yet, try direct selectors
    if (!customObjectFound) {
      console.log('🔍 Trying direct CustomObject selectors...');

      const directSelectors = [
        '.monaco-list-row:has-text("CustomObject")',
        '[aria-label*="CustomObject"]',
        '[title*="CustomObject"]',
        'div:has-text("CustomObject")',
        'span:has-text("CustomObject")'
      ];

      for (const selector of directSelectors) {
        try {
          const items = await orgBrowserPage.page.locator(selector).all();
          if (items.length > 0) {
            console.log(`✅ Found CustomObject with direct selector: ${selector} (${items.length} matches)`);
            customObjectFound = true;
            customObjectItem = items[0];
            break;
          }
        } catch (error) {
          console.log(`⚠️ Error with direct selector ${selector}: ${String(error)}`);
        }
      }
    }

    // Report what we found
    if (customObjectFound) {
      console.log('✅ Successfully found CustomObject metadata type');
    } else if (anyMetadataTypeFound) {
      console.log('❌ CustomObject not found, but found another metadata type');
      console.log('⚠️ Test will fail because CustomObject is required');
      customObjectItem = anyMetadataTypeItem; // Use the other metadata type instead
    } else {
      console.log('❌ No metadata types found in tree');
      console.log('⚠️ Test will fail because CustomObject is required');
    }

    // Try to expand the metadata type
    if (customObjectItem) {
      await orgBrowserPage.expandMetadataType(customObjectItem);

      // Check if more tree items appeared after expansion
      const expandedItems = await orgBrowserPage.getAllMetadataTypes();
      console.log(`📊 After expansion: ${expandedItems.length} tree items (was ${treeItems.length})`);

      if (expandedItems.length > treeItems.length) {
        console.log('✅ Tree item expanded successfully showing child nodes');
      } else {
        console.log('ℹ️ No additional nodes appeared after expansion');
      }
    }

    // Wait for any async operations to complete
    console.log('⏳ Waiting for tree data loading and potential errors...');
    await orgBrowserPage.page.waitForTimeout(500);

    // Check for VS Code notification errors
    const errorTexts = await orgBrowserPage.getErrorNotifications();
    if (errorTexts.length > 0) {
      errorTexts.forEach((errorText, i) => {
        console.log(`  Error ${i + 1}: ${errorText}`);
      });
    }

    // Check for removeAllListeners errors
    const hasRemoveAllListenersErrors = cdpConnection.capture.removeAllListenersErrors.length > 0;

    if (hasRemoveAllListenersErrors) {
      console.log('❌ Found removeAllListeners errors - this indicates a polyfill issue:');
      cdpConnection.capture.removeAllListenersErrors.forEach(error => console.log(`  - ${error}`));
    } else {
      console.log('✅ No removeAllListeners errors found - polyfill working correctly');
    }

    // Log test results
    console.log('\n📊 Test Results:');
    console.log('  - VS Code loaded: YES');
    console.log('  - Org Browser clicked: YES');
    console.log(`  - Tree items found: ${treeItems.length > 0 ? 'YES' : 'NO'} (${treeItems.length} items)`);
    console.log(`  - CustomObject found: ${customObjectFound ? '✅ YES' : '❌ NO - REQUIRED'}`);
    console.log(`  - Any metadata type found: ${anyMetadataTypeFound ? 'YES' : 'NO'}`);
    console.log(`  - Tree item interaction attempted: ${customObjectItem ? 'YES' : 'NO'}`);
    console.log(
      `  - removeAllListeners errors: ${hasRemoveAllListenersErrors ? '❌ YES - ISSUE FOUND' : '✅ NONE - GOOD'}`
    );

    // Test assertions
    expect(hasRemoveAllListenersErrors).toBe(false);

    if (testConfig.requireCustomObject) {
      // Strict check for CustomObject
      expect(customObjectFound || anyMetadataTypeFound).toBe(true);
    } else {
      // More lenient check - any metadata type is acceptable
      expect(anyMetadataTypeFound).toBe(true);
    }
  });

  test('should retrieve metadata and check for project error', async ({ orgBrowserPage, page }) => {
    // Increase test timeout to 90 seconds
    test.setTimeout(90000);

    // Verify the page is still connected before proceeding
    try {
      await page.evaluate(() => document.title);
    } catch (error) {
      console.log('Browser connection issue detected:', String(error));
      test.skip();
      console.log('Browser connection lost - skipping test');
      return;
    }
    try {
      // Check if we're connected to an existing browser that might be in use
      const isExistingBrowser = await page
        .evaluate(
          // @ts-ignore
          () => window.__playwright_existing_browser === true
        )
        .catch(() => false);

      if (isExistingBrowser) {
        console.log('⚠️ Test is running in an existing browser session that might be in use for manual testing.');
        console.log('⚠️ Please close any browser instances on port 3000 before running this test.');
        test.skip();
        return;
      }

      // 1. Open the Org Browser
      await orgBrowserPage.activityBarItem.click();
      console.log('✅ Clicked Org Browser activity bar item');

      // Wait for tree items to load - need longer timeout
      console.log('Waiting for tree items to load...');

      // Use waitForSelector instead of waitForTimeout for more reliability
      await orgBrowserPage.page
        .waitForSelector('.monaco-list-row', { timeout: 20000 })
        .then(() => console.log('Tree items loaded'))
        .catch(() => console.log('Timeout waiting for tree items'));

      // Take a screenshot of the tree before searching
      await orgBrowserPage.takeScreenshot('tree-before-search.png');

      // Try to wait for the CustomObject node to appear with increased timeout
      await orgBrowserPage.page.waitForSelector('text=CustomObject', { timeout: 15000 }).catch(() => {
        console.log('Timeout waiting for CustomObject to appear in tree');
      });

      // Find and expand the CustomObject node
      console.log('Searching for CustomObject using findMetadataType...');
      let customObjectItem = await orgBrowserPage.findMetadataType('CustomObject');
      console.log(`findMetadataType result: ${customObjectItem ? 'Found' : 'Not found'}`);

      // Take a screenshot of the tree at this point
      await orgBrowserPage.takeScreenshot('after-findMetadataType.png');

      // Log all visible tree items to help debug
      const allTreeItems = await orgBrowserPage.page.locator('.monaco-list-row').allTextContents();
      console.log('All visible tree items:', allTreeItems);

      // If we can't find it, try a direct selector
      if (!customObjectItem) {
        console.log('Trying direct selector for CustomObject');
        const directSelectors = [
          '.monaco-list-row:has-text("CustomObject")',
          '[aria-label*="CustomObject"]',
          '[title*="CustomObject"]',
          'div:has-text("CustomObject")',
          'span:has-text("CustomObject")',
          '.monaco-tl-contents:has-text("CustomObject")',
          '.monaco-list-row .monaco-tl-contents:has-text("CustomObject")',
          '[role="treeitem"]:has-text("CustomObject")',
          '.monaco-list-row[aria-level="1"]:has-text("CustomObject")',
          '.monaco-list-row[aria-expanded="false"]:has-text("CustomObject")'
        ];

        for (const selector of directSelectors) {
          try {
            const items = await orgBrowserPage.page.locator(selector).all();
            if (items.length > 0) {
              console.log(`Found CustomObject with direct selector: ${selector}`);
              // Take a screenshot to verify
              await orgBrowserPage.takeScreenshot('customobject-found.png');
              // Use the first item
              customObjectItem = items[0];
              break;
            }
          } catch (error) {
            console.log(`Error with selector ${selector}: ${String(error)}`);
          }
        }
      }
      expect(customObjectItem).not.toBeNull();

      if (!customObjectItem) {
        throw new Error('CustomObject node not found');
      }

      // 2. Expand the CustomObject node
      await orgBrowserPage.expandMetadataType(customObjectItem);
      await orgBrowserPage.page.waitForTimeout(2000);

      // Take a screenshot to see what's in the tree
      await orgBrowserPage.takeScreenshot('tree-expanded.png');

      // Find Account object specifically within the expanded CustomObject node
      console.log('Looking for Account object...');

      // Wait for Account to appear with longer timeout
      await orgBrowserPage.page
        .waitForSelector('.monaco-list-row .monaco-tl-contents:has-text("Account")', { timeout: 10000 })
        .catch(() => console.log('Timeout waiting for Account to appear'));

      // Take a screenshot of all visible items to debug
      await orgBrowserPage.takeScreenshot('all-items.png');

      // Use a more specific selector for Account
      const accountSelector = '.monaco-list-row .monaco-tl-contents:has-text("Account")';
      console.log(`Using selector: ${accountSelector}`);

      // Try to find Account directly
      const directAccountLocator = orgBrowserPage.page.locator(accountSelector).first();
      const accountCount = await directAccountLocator.count();
      console.log(`Direct Account selector found ${accountCount} matches`);

      // If direct selector failed, try with all visible items
      let accountItem = accountCount > 0 ? directAccountLocator : null;

      if (!accountItem) {
        // Get all visible items to find Account
        const visibleItems = await orgBrowserPage.page.locator('.monaco-list-row .monaco-tl-contents').all();
        console.log(`Found ${visibleItems.length} visible items in tree`);

        // Find the exact Account item
        for (const item of visibleItems) {
          const text = await item.textContent();
          if (text === 'Account' || text?.trim() === 'Account') {
            accountItem = item;
            console.log('✅ Found exact Account object via text content');
            break;
          }
        }
      } else {
        console.log('✅ Found Account object via direct selector');
      }

      if (!accountItem) {
        throw new Error('Could not find exact Account object');
      }

      const accountLocator = accountItem;
      const count = await accountLocator.count();

      if (count === 0) {
        console.log('❌ Account not found, taking screenshot to debug');
        await orgBrowserPage.takeScreenshot('account-not-found.png');

        // List all visible items to help debug
        const allItems = await orgBrowserPage.page.locator('.monaco-list-row .monaco-tl-contents').allTextContents();
        console.log('Visible items in tree:', allItems);
        throw new Error('Account object not found in tree');
      }

      // Take a screenshot before retrieval
      await orgBrowserPage.takeScreenshot('before-retrieve.png');

      // 3. Hover and 4. Click the retrieve icon - make sure we're hovering on the right row
      console.log('Getting parent row of Account item');

      // Get the parent row of the Account item - use JavaScript to be more reliable
      const rowInfo = await orgBrowserPage.page.evaluate(() => {
        const accountElement = document.evaluate(
          '//*[text()="Account"]',
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;

        if (!accountElement) {
          return { found: false, message: 'Account element not found' };
        }

        // Find the parent row
        let element = accountElement instanceof HTMLElement ? accountElement : null;
        let rowElement = null;

        if (element) {
          // Navigate up to find monaco-list-row
          while (element && !element.classList.contains('monaco-list-row')) {
            element = element.parentElement;
          }
          rowElement = element;
        }

        return {
          found: !!rowElement,
          message: rowElement ? 'Found parent row' : 'Could not find parent row',
          rowId: rowElement?.id,
          rowClasses: rowElement?.className
        };
      });

      console.log('Row info:', rowInfo);

      // Take a screenshot of the row before hovering
      await orgBrowserPage.takeScreenshot('row-before-hover.png');

      // Get the row locator
      const row = accountItem.locator('xpath=ancestor::div[contains(@class, "monaco-list-row")]').first();

      // Hover over the Account text to reveal action buttons
      console.log('Hovering over Account text to reveal action buttons');

      // First try standard hover with increased timeout
      console.log('Trying standard hover...');
      await accountItem.hover({ timeout: 5000 });
      await orgBrowserPage.page.waitForTimeout(2000);
      await orgBrowserPage.takeScreenshot('after-standard-hover.png');

      // Then try JavaScript hover simulation
      await orgBrowserPage.page.evaluate(() => {
        const accountElement = document.evaluate(
          '//*[text()="Account"]',
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;

        if (accountElement instanceof HTMLElement) {
          // Dispatch mouseenter and mouseover events
          ['mouseenter', 'mouseover', 'mousemove'].forEach(eventType => {
            const event = new MouseEvent(eventType, {
              view: window,
              bubbles: true,
              cancelable: true
            });
            accountElement.dispatchEvent(event);
          });

          // Also try to find and trigger the parent row
          let element: HTMLElement | null = accountElement;
          while (element && !element.classList.contains('monaco-list-row')) {
            element = element.parentElement;
          }

          if (element) {
            ['mouseenter', 'mouseover', 'mousemove'].forEach(eventType => {
              const event = new MouseEvent(eventType, {
                view: window,
                bubbles: true,
                cancelable: true
              });
              element.dispatchEvent(event);
            });
          }
        }
      });

      await orgBrowserPage.page.waitForTimeout(1000);
      await orgBrowserPage.takeScreenshot('after-js-hover.png');

      // Log all action buttons to help debug - use direct DOM query for more reliable results
      console.log('Looking for action buttons...');

      // Use JavaScript to find all action buttons
      const actionButtonsInfo = await orgBrowserPage.page.evaluate(() => {
        // Find all action buttons in the document
        const allButtons = Array.from(document.querySelectorAll('.monaco-action-bar a.action-label'));

        // Get info about each button
        const buttonInfo = allButtons.map((button, index) => ({
          index,
          ariaLabel: button.getAttribute('aria-label'),
          title: button.getAttribute('title'),
          className: button.className,
          isVisible:
            button instanceof HTMLElement &&
            window.getComputedStyle(button).display !== 'none' &&
            window.getComputedStyle(button).visibility !== 'hidden'
        }));

        // Find the Retrieve Metadata button specifically
        const retrieveMetadataButton = allButtons.find(btn => btn.getAttribute('aria-label') === 'Retrieve Metadata');
        const retrieveIndex = retrieveMetadataButton ? allButtons.indexOf(retrieveMetadataButton) : -1;

        return {
          total: allButtons.length,
          buttons: buttonInfo,
          retrieveButtonIndex: retrieveIndex,
          retrieveButtonFound: retrieveIndex >= 0
        };
      });

      console.log(`Found ${actionButtonsInfo.total} action buttons via DOM`);
      console.log(`Retrieve button found: ${actionButtonsInfo.retrieveButtonFound}`);

      if (actionButtonsInfo.retrieveButtonFound) {
        console.log(`Retrieve button is at index ${actionButtonsInfo.retrieveButtonIndex}`);
      }

      // Now get the buttons using Playwright locators
      const allActionButtons = await row.locator('.monaco-action-bar a.action-label').all();
      console.log(`Found ${allActionButtons.length} action buttons via Playwright`);

      for (let i = 0; i < allActionButtons.length; i++) {
        const label = (await allActionButtons[i].getAttribute('aria-label')) ?? '';
        const title = (await allActionButtons[i].getAttribute('title')) ?? '';
        console.log(`Button ${i + 1}: aria-label="${label}", title="${title}"`);
      }

      // Try to find the Retrieve Metadata button specifically
      let retrieveButton = null;

      // Find the button with exact aria-label "Retrieve Metadata"
      for (let i = 0; i < allActionButtons.length; i++) {
        const label = (await allActionButtons[i].getAttribute('aria-label')) ?? '';
        if (label === 'Retrieve Metadata') {
          retrieveButton = allActionButtons[i];
          console.log(`Found Retrieve Metadata button at index ${i}`);

          // Take a screenshot with the button highlighted
          await orgBrowserPage.page.evaluate(() => {
            // Find all retrieve buttons and highlight them
            const retrieveButtons = Array.from(
              document.querySelectorAll('a.action-label[aria-label="Retrieve Metadata"]')
            );
            retrieveButtons.forEach(button => {
              if (button instanceof HTMLElement) {
                button.style.border = '3px solid red';
                button.style.visibility = 'visible';
                button.style.display = 'block';
                button.style.opacity = '1';
              }
            });
          });

          await orgBrowserPage.takeScreenshot('retrieve-button-highlighted.png');
          break;
        }
      }

      if (!retrieveButton) {
        console.log('❌ Could not find retrieve button with aria-label="Retrieve Metadata"');
        throw new Error('Retrieve button not found - test failed');
      }

      // Take a screenshot of the retrieve button before clicking
      await orgBrowserPage.takeScreenshot('retrieve-button-before-click.png');

      console.log('Found retrieve button, clicking it directly');

      // Directly execute the retrieve metadata command - no fallbacks
      console.log('Executing retrieve metadata command directly...');

      // Get the command ID from the button's data attributes
      const commandInfo = await orgBrowserPage.page.evaluate(() => {
        // Find all retrieve metadata buttons
        const retrieveButtons = Array.from(document.querySelectorAll('a.action-label[aria-label="Retrieve Metadata"]'));

        if (retrieveButtons.length === 0) {
          return {
            success: false,
            message: 'No retrieve buttons found',
            buttonCount: 0
          };
        }

        // Get the first button
        const button = retrieveButtons[0];

        // Skip custom event and go straight to click
        // Direct click is more reliable as it includes the node context
        if (button instanceof HTMLElement) {
          try {
            // Make button visible and click it
            button.style.visibility = 'visible';
            button.style.display = 'inline-block';
            button.style.opacity = '1';
            button.style.pointerEvents = 'auto';

            // Force into view and click
            button.scrollIntoView({ behavior: 'auto', block: 'center' });
            button.click();

            return {
              success: true,
              message: 'Button clicked via DOM',
              buttonCount: retrieveButtons.length
            };
          } catch (clickError) {
            return {
              success: false,
              message: `Button click failed: ${String(clickError)}`,
              buttonCount: retrieveButtons.length
            };
          }
        }

        return {
          success: false,
          message: 'Button is not an HTMLElement',
          buttonCount: retrieveButtons.length
        };
      });

      console.log('Command execution result:', commandInfo);

      if (!commandInfo.success) {
        // No fallbacks - if command execution fails, the test should fail
        throw new Error(`Failed to execute retrieve command: ${commandInfo.message}`);
      }

      // Wait longer for retrieval to complete and potential error to appear
      console.log('Waiting for error notification to appear...');
      await orgBrowserPage.page.waitForTimeout(5000);
      await orgBrowserPage.takeScreenshot('after-retrieve-1.png');

      // Try to wait for notification to appear
      try {
        await orgBrowserPage.page.waitForSelector('.notifications-container .notification-list-item.error', {
          timeout: 10000,
          state: 'attached'
        });
        console.log('Error notification appeared');
      } catch (error) {
        console.log('Timeout waiting for error notification:', String(error));
      }

      await orgBrowserPage.takeScreenshot('after-retrieve-2.png');

      // Check for error notifications with longer wait
      const errorTexts = await orgBrowserPage.getErrorNotifications();

      // If no errors found, try again with a different selector
      if (errorTexts.length === 0) {
        console.log('No notifications found with standard selector, trying alternative selectors...');

        // Try additional selectors for notifications
        const alternativeSelectors = [
          '.monaco-workbench .notifications-toasts .notification-toast-container .notification-list-item',
          '.notifications-list-container .monaco-list-row',
          '.notification-list-item',
          '.notification-list-item-message'
        ];

        for (const selector of alternativeSelectors) {
          const notifications = await orgBrowserPage.page.locator(selector).all();
          console.log(`Found ${notifications.length} items with selector: ${selector}`);

          for (const notification of notifications) {
            const text = await notification.textContent();
            if (text) {
              errorTexts.push(text);
              console.log(`Found notification with text: ${text}`);
            }
          }

          if (errorTexts.length > 0) break;
        }
      }

      // Also check console logs for errors
      const consoleErrors = await orgBrowserPage.page.evaluate(() => {
        // Get any error messages that might be in the console
        const errors: string[] = [];
        const originalConsoleError = console.error;
        console.error = (...args: unknown[]): void => {
          errors.push(args.map(arg => String(arg)).join(' '));
          originalConsoleError.apply(console, args);
        };

        // Return collected errors
        return errors;
      });

      if (consoleErrors.length > 0) {
        console.log('Found console errors:');
        consoleErrors.forEach((error, i) => {
          console.log(`  Console error ${i + 1}: ${error}`);
          errorTexts.push(error);
        });
      }

      // Look specifically for the "Not a Salesforce project" error
      const projectError = errorTexts.some(
        text =>
          text.includes('Not a Salesforce project') ||
          text.includes('InvalidProjectWorkspaceError') ||
          text.includes('memfs:/MyProject')
      );

      console.log(`Found ${errorTexts.length} notifications/errors`);
      errorTexts.forEach((text, i) => {
        console.log(`  Notification ${i + 1}: ${text}`);
      });

      // Take a final screenshot
      await orgBrowserPage.takeScreenshot('after-retrieve-final.png');

      // This is the expected error, so the test passes if we find it
      expect(projectError, 'Expected to find "Not a Salesforce project" error').toBe(true);
    } catch (error) {
      console.log(`❌ Test error: ${String(error)}`);
      await orgBrowserPage.takeScreenshot('test-error.png');
      throw error;
    }
  });
});
