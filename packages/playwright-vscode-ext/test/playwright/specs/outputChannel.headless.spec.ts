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
import {
  waitForVSCodeWorkbench,
  closeWelcomeTabs
} from '../../../src/utils/helpers';
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

    await test.step('Select Extensions channel', async () => {
      await selectOutputChannel(page, 'Extensions');
    });

    await test.step('Verify channel is selected', async () => {
      const channelSelector = page.locator('.output-channels-dropdown');
      await expect(channelSelector).toContainText('Extensions');
    });
  });

  test('should wait for output text', async ({ page }) => {
    await test.step('Open output panel', async () => {
      await ensureOutputPanelOpen(page);
    });

    await test.step('Select Log channel', async () => {
      await selectOutputChannel(page, 'Log (Window)');
    });

    await test.step('Wait for text in output', async () => {
      // Log channel should have some content
      await waitForOutputChannelText(page, { expectedText: 'Window', timeout: 5000 });
    });
  });

  test('should check if output contains text', async ({ page }) => {
    await test.step('Open output panel', async () => {
      await ensureOutputPanelOpen(page);
    });

    await test.step('Select Log channel', async () => {
      await selectOutputChannel(page, 'Log (Window)');
    });

    await test.step('Check if output contains text', async () => {
      const contains = await outputChannelContains(page, 'Window');
      expect(contains).toBe(true);
    });
  });

  test('should clear output channel', async ({ page }) => {
    await test.step('Open output panel', async () => {
      await ensureOutputPanelOpen(page);
    });

    await test.step('Select Log channel', async () => {
      await selectOutputChannel(page, 'Log (Window)');
    });

    await test.step('Clear output channel', async () => {
      await clearOutputChannel(page);
    });

    await test.step('Verify output is cleared', async () => {
      const outputContent = page.locator('.view-lines');
      const text = await outputContent.textContent();
      expect(text?.trim().length).toBeLessThan(50);
    });
  });
});
