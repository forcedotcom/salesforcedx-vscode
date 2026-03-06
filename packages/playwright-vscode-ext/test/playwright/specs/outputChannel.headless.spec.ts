/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText
} from '../../../src/pages/outputChannel';
import { saveScreenshot } from '../../../src/shared/screenshotUtils';
import {
  waitForVSCodeWorkbench,
  assertWelcomeTabExists,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden
} from '../../../src/utils/helpers';
import { EDITOR } from '../../../src/utils/locators';
import { test } from '../fixtures/index';

const OUTPUT_PANEL_ID = '[id="workbench.panel.output"]';
const outputPanelViewLines = (page: Page) => page.locator(OUTPUT_PANEL_ID).locator(`${EDITOR} .view-lines`);
const outputFilterInput = (page: Page) =>
  page.getByRole('textbox', { name: /Filter \(e\.g\./ }).first();

test.describe('Output Channel', () => {
  test.beforeEach(async ({ page }) => {
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
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
      await waitForOutputChannelText(page, { expectedText: 'Salesforce', timeout: 10_000 });
    });
  });

  test('should filter output channel content', async ({ page }) => {
    test.setTimeout(15_000);
    const viewLines = () => page.locator(OUTPUT_PANEL_ID).locator(`${EDITOR} .view-line`);

    await test.step('open output panel and select high-volume channel', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Window');
    });

    await test.step('wait for content', async () => {
      await expect(async () => {
        const count = await viewLines().count();
        expect(count, 'channel should have multiple lines').toBeGreaterThan(3);
      }).toPass({ timeout: 5000 });
      await saveScreenshot(page, 'filter-test-unfiltered.png', false);
    });

    await test.step('apply matching filter and verify content remains', async () => {
      const input = outputFilterInput(page);
      await expect(input, 'filter input should be visible').toBeVisible({ timeout: 5000 });
      await input.focus();
      await input.fill('Window');
      await expect(input).toHaveValue('Window', { timeout: 2000 });
      await input.press('Enter');

      await expect(async () => {
        const text = ((await outputPanelViewLines(page).textContent()) ?? '').replaceAll('\u00A0', ' ');
        expect(text.toLowerCase(), 'filtered output should contain matching term').toContain('window');
      }).toPass({ timeout: 5000 });
      await saveScreenshot(page, 'filter-test-matching.png', false);
    });

    await test.step('apply non-existent filter and verify content disappears', async () => {
      const input = outputFilterInput(page);
      await input.focus();
      await input.fill('zzz_nonexistent_term_zzz');
      await expect(input).toHaveValue('zzz_nonexistent_term_zzz', { timeout: 2000 });
      await input.press('Enter');

      // setHiddenAreas should hide all lines; Monaco may keep one empty placeholder line
      await expect(async () => {
        const count = await viewLines().count();
        expect(count, 'at most one empty line should remain with non-existent filter').toBeLessThanOrEqual(1);
        const text = ((await outputPanelViewLines(page).textContent()) ?? '').trim();
        expect(text.length, 'output should be empty with non-existent filter').toBe(0);
      }).toPass({ timeout: 5000 });
      await saveScreenshot(page, 'filter-test-empty.png', false);
    });

    await test.step('clear filter and verify content restores', async () => {
      const input = outputFilterInput(page);
      await input.focus();
      await input.fill('');
      await input.press('Enter');

      await expect(async () => {
        const count = await viewLines().count();
        expect(count, 'lines should return after clearing filter').toBeGreaterThan(3);
      }).toPass({ timeout: 5000 });
      await saveScreenshot(page, 'filter-test-restored.png', false);
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
