/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  outputChannelContains
} from '../../../src/pages/outputChannel';
import { saveScreenshot } from '../../../src/shared/screenshotUtils';
import {
  waitForVSCodeWorkbench,
  closeWelcomeTabs
} from '../../../src/utils/helpers';
import { EDITOR } from '../../../src/utils/locators';
import { test } from '../fixtures/index';

test.describe('Output Channel', () => {
  test.beforeEach(async ({ page }) => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
  });

  test('should open output panel', async ({ page }) => {
    await test.step('Open output panel', async () => {
      await ensureOutputPanelOpen(page);
    });

    await test.step('Verify output panel is visible', async () => {
      const outputPanel = page.locator('.part.panel.bottom .composite.title', { hasText: 'Output' });
      await expect(outputPanel).toBeVisible();
    });
  });

  test('should select output channel', async ({ page }) => {
    await test.step('Open output panel', async () => {
      await ensureOutputPanelOpen(page);
    });

    await test.step('Select Tasks channel', async () => {
      await selectOutputChannel(page, 'Tasks');
    });

    await test.step('Verify channel is selected', async () => {
      const channelSelector = page.locator('[id="workbench.panel.output"]').locator('select.monaco-select-box');
      await channelSelector.waitFor({ state: 'attached', timeout: 5000 });
      await expect(channelSelector).toHaveValue('Tasks', { timeout: 5000 });
    });
  });

  test('should wait for output text', async ({ page }) => {
    await test.step('Open output panel', async () => {
      await ensureOutputPanelOpen(page);
    });

    await test.step('Select Salesforce Services channel', async () => {
      await selectOutputChannel(page, 'Salesforce Services');
    });

    await test.step('Wait for text in output', async () => {
      // Salesforce Services channel should have service initialization messages
      await waitForOutputChannelText(page, { expectedText: 'Salesforce', timeout: 10_000 });
    });
  });

  test('should check if output contains text', async ({ page }) => {
    await test.step('Open output panel', async () => {
      await ensureOutputPanelOpen(page);
    });

    await test.step('Select Salesforce Services channel', async () => {
      await selectOutputChannel(page, 'Salesforce Services');
    });

    await test.step('Check if output contains text', async () => {
      const contains = await outputChannelContains(page, 'Salesforce');
      expect(contains).toBe(true);
    });
  });

  test('should clear output channel', async ({ page }) => {
    await test.step('Open output panel', async () => {
      await ensureOutputPanelOpen(page);
    });

    await test.step('Select Window channel', async () => {
      await selectOutputChannel(page, 'Window');
    });

    await test.step('Clear output channel and verify', async () => {
      // clearOutputChannel already verifies the channel is completely cleared internally
      await clearOutputChannel(page);
      // Take screenshot to verify output channel is completely clear (requirement 1a)
      await saveScreenshot(page, 'output-channel-cleared.png', false);
      // Verify channel is still completely cleared after screenshot (requirement 1a)
      const codeArea = page.locator('[id="workbench.panel.output"]').locator(`${EDITOR} .view-lines`);
      const text = await codeArea.textContent();
      expect(text?.trim().length ?? 0, 'Output channel should be completely cleared with no text left').toBe(0);
    });
  });
});
