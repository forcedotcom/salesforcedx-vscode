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
    const textbox = page.getByRole('textbox', { name: /command/i });
    await textbox.fill(`>${command}`);
    await textbox.press('Enter');
  });
};
