/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { test } from '../fixtures/index';
import {
  closeWelcomeTabs,
  waitForWorkspaceReady,
  waitForVSCodeWorkbench
} from '../../../src/utils/helpers';
import { WORKBENCH } from '../../../src/utils/locators';

test.describe('Helper Functions', () => {
  test('waitForVSCodeWorkbench should wait for workbench to load', async ({ page }) => {
    await test.step('Wait for VS Code workbench to be visible', async () => {
      await waitForVSCodeWorkbench(page);
      const workbench = page.locator(WORKBENCH);
      await expect(workbench).toBeVisible();
    });
  });

  test('closeWelcomeTabs should close welcome tabs', async ({ page }) => {
    await test.step('Wait for workbench', async () => {
      await waitForVSCodeWorkbench(page);
    });

    await test.step('Close welcome tabs if present', async () => {
      await closeWelcomeTabs(page);
      // Verify no welcome tab remains visible by checking tab titles
      const tabs = page.locator('.tabs-container .tab');
      const tabCount = await tabs.count();

      for (let i = 0; i < tabCount; i++) {
        const tabTitle = await tabs.nth(i).getAttribute('aria-label');
        expect(tabTitle).not.toContain('Welcome');
      }
    });
  });

  test('waitForWorkspaceReady should wait for workspace to be ready', async ({ page }) => {
    await test.step('Wait for VS Code workbench', async () => {
      await waitForVSCodeWorkbench(page);
    });

    await test.step('Wait for workspace to be ready', async () => {
      await waitForWorkspaceReady(page);
      // Verify the workspace is ready by checking key UI elements exist
      const workbench = page.locator(WORKBENCH);
      await expect(workbench).toBeVisible();
    });
  });
});
