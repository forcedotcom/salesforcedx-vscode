/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { QUICK_INPUT_WIDGET, setupMinimalOrgAndAuth } from '@salesforce/playwright-vscode-ext';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from '../fixtures';

test('an apex-replay launch activates the extension and prompts for a log file', async ({ page, workspaceDir }) => {
  test.setTimeout(300_000);
  await setupMinimalOrgAndAuth(page);

  const vscodeDirectory = path.join(workspaceDir, '.vscode');
  await fs.mkdir(vscodeDirectory, { recursive: true });
  await fs.writeFile(
    path.join(vscodeDirectory, 'launch.json'),
    JSON.stringify({
      version: '0.2.0',
      configurations: [
        {
          name: 'Prompt for Apex Replay Debug Log',
          type: 'apex-replay',
          request: 'launch',
          logFile: '${command:AskForLogFileName}',
          stopOnEntry: true,
          trace: true
        }
      ]
    })
  );

  await page.keyboard.press('F5');

  const filePicker = page.locator(QUICK_INPUT_WIDGET);
  await expect(filePicker).toBeVisible({ timeout: 30_000 });
  await expect(filePicker.getByRole('textbox', { name: 'Folder path' })).toBeVisible();
  await expect(filePicker.getByRole('button', { name: 'OK' })).toBeVisible();
  await page.keyboard.press('Escape');
});
