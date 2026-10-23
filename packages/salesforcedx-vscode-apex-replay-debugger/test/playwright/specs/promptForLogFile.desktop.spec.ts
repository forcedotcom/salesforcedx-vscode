/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { QUICK_INPUT_WIDGET, resetContainerWorkbench, setupMinimalOrgAndAuth } from '@salesforce/playwright-vscode-ext';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isContainer, sharedWorkspaceDirTest as test } from '../fixtures';

// Byte-identical to the container fixture's seeded container-workspace/.vscode/launch.json, so the
// container write is a no-op (the config is already there at boot) and leaves the fixture clean.
const LAUNCH_JSON = `${JSON.stringify(
  {
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
  },
  null,
  2
)}\n`;

// No org setup on the container's shared, persistent workbench — it uses the boot (default) org, and
// editors/notifications are reset before each test rather than assuming a clean slate.
test.beforeEach(async ({ page }) => {
  if (isContainer) {
    await resetContainerWorkbench(page);
  }
});

test('an apex-replay launch activates the extension and prompts for a log file', async ({ page, workspaceDir }) => {
  test.setTimeout(300_000);
  if (!isContainer) {
    await setupMinimalOrgAndAuth(page);
  }

  const vscodeDirectory = path.join(workspaceDir, '.vscode');
  await fs.mkdir(vscodeDirectory, { recursive: true });
  await fs.writeFile(path.join(vscodeDirectory, 'launch.json'), LAUNCH_JSON);

  // A single apex-replay config, so F5 runs it without a config picker; its
  // ${command:AskForLogFileName} opens the log-file quick-input.
  await page.keyboard.press('F5');

  const filePicker = page.locator(QUICK_INPUT_WIDGET);
  await expect(filePicker).toBeVisible({ timeout: 30_000 });
  await expect(filePicker.getByRole('textbox', { name: 'Folder path' })).toBeVisible();
  await expect(filePicker.getByRole('button', { name: 'OK' })).toBeVisible();
  // Dismiss without selecting, so no debug session starts.
  await page.keyboard.press('Escape');
  await expect(filePicker).not.toBeVisible({ timeout: 15_000 });
});
