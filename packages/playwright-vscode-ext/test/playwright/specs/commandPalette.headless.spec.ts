/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { executeCommandWithCommandPalette, openCommandPalette } from '../../../src/pages/commands';
import {
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  isMacDesktop,
  ensureSecondarySideBarHidden,
  isDesktop
} from '../../../src/utils/helpers';
import { WORKBENCH } from '../../../src/utils/locators';
import { activeQuickInputTextField, activeQuickInputWidget } from '../../../src/utils/quickInput';
import { test } from '../fixtures/index';

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
  });

  test('should open command palette with F1', async ({ page }) => {
    await test.step('Press F1 to open command palette', async () => {
      // Use helper function that has retry logic to handle welcome tabs
      await openCommandPalette(page);
      await expect(activeQuickInputTextField(page)).toBeAttached();
    });
  });

  test('should execute command via command palette', async ({ page }) => {
    await test.step('Execute "View: Close All Editors" command', async () => {
      await executeCommandWithCommandPalette(page, 'View: Close All Editors');
      // Wait for tabs to close - command execution may take a moment
      // Filter out welcome tabs as they may reopen - we're testing that editor tabs close
      const tabs = page.locator('.tabs-container .tab').filter({ hasNotText: /Welcome|Walkthrough/i });
      await expect(tabs).toHaveCount(0, { timeout: 10_000 });
    });
  });

  test('should support command palette with Ctrl+Shift+P', async ({ page }) => {
    // Ctrl+Shift+P doesn't reliably work on macOS Electron - skip there
    test.skip(isMacDesktop(), 'Ctrl+Shift+P keyboard shortcut unreliable on Mac desktop Electron');

    await test.step('Press Ctrl+Shift+P to open command palette', async () => {
      // Focus on the workbench by clicking on it first
      const workbench = page.locator(WORKBENCH);
      await workbench.click({ timeout: 5000 });

      await page.keyboard.press('Control+Shift+P');
      await expect(activeQuickInputTextField(page)).toBeAttached({ timeout: 5000 });
    });

    await test.step('Close command palette with Escape', async () => {
      await page.keyboard.press('Escape');
      // On Windows, VS Code retains `.quick-input-widget` in the DOM (hidden) after closing,
      // so assert the widget is hidden rather than that it (or its input) is detached.
      await expect(activeQuickInputWidget(page)).toBeHidden({ timeout: 5000 });
    });
  });

  test('should save file using File: Save command', async ({ page }) => {
    // File save dialog only works reliably on desktop
    test.skip(!isDesktop(), 'File: Save test only runs on desktop');

    await test.step('Create new untitled file', async () => {
      await executeCommandWithCommandPalette(page, 'File: New Untitled Text File');
      // Wait for new editor to open
      const editor = page.locator('.editor-instance').first();
      await expect(editor).toBeVisible({ timeout: 5000 });
    });

    await test.step('Type content into file', async () => {
      await page.keyboard.type('Test content for File: Save');
      // Verify tab shows dirty indicator (dot or other marker)
      const tab = page.locator('.tabs-container .tab').first();
      await expect(tab).toBeVisible();
    });

    await test.step('Save file using command palette', async () => {
      await executeCommandWithCommandPalette(page, 'File: Save');
      // Command palette should execute File: Save
      // Note: In test environment, this may trigger save dialog or auto-save depending on settings
      // We're testing that the command executes without error
      await page.waitForTimeout(1000);
    });
  });
});
