import type { Page } from '@playwright/test';
import { test } from 'vscode-test-playwright';

export const openCommandPalette = async (page: Page) => {
  await test.step('open command palette', async () => {
    await page.keyboard.press('ControlOrMeta+Shift+P');
    await page.getByRole('textbox', { name: /command/i }).waitFor({ state: 'visible' });
  });
};

export const runCommandPaletteCommand = async (page: Page, command: string) => {
  await test.step(`run command palette command: ${command}`, async () => {
    await openCommandPalette(page);
    const textbox = page.getByRole('textbox', { name: /command/i });
    await textbox.fill(`>${command}`);
    await textbox.press('Enter');
    // Wait until the textbox value contains the expected command (case-insensitive)
    const expected = command.toLowerCase();
    const timeout = 5000;
    const pollInterval = 100;
    const start = Date.now();
    while (true) {
      await openCommandPalette(page);
      const textbox = page.getByRole('textbox', { name: /command/i });
      await textbox.fill(`>${command}`);
      await textbox.press('Enter');
      const value = await textbox.getAttribute('value');
      if (value && value.toLowerCase().includes(expected)) break;
      if (Date.now() - start > timeout) break;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(pollInterval);
    }
  });
};
