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
    const timeout = 15000;
    const pollInterval = 100;
    const start = Date.now();
    while (true) {
      await openCommandPalette(page);
      const textbox = page.getByRole('textbox', { name: /command/i });
      await textbox.fill(`>${command}`);

      if (Date.now() - start > timeout) {
        throw new Error(`Command ${command} not found in palette`);
      }
      if (await isCommandInPalette(page, command)) {
        await textbox.press('Enter');
        break;
      }
      await page.waitForTimeout(pollInterval);
    }
  });
};

const isCommandInPalette = async (page: Page, commandText: string) => {
  //await page.locator('a').filter({ hasText: 'SFDX: Create Apex Class' })
  const items = page.locator('a').filter({ hasText: commandText });
  return await items.isVisible();
};
