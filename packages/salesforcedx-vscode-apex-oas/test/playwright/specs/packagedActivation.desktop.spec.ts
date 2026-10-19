/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from '@playwright/test';
import { waitForNotification } from '@salesforce/playwright-vscode-ext';
import { readFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { messages } from '../../../src/messages/i18n';
import { oasVsixSmokeTest as test } from '../fixtures/packagedActivationFixtures';

test('Packaged Apex OAS activates and handles validation without A4V', async ({
  page,
  workspaceDir,
  installedExtensionsDir
}) => {
  await test.step('verify installed artifact, activation, and command registration', async () => {
    await expect(async () => {
      const result = JSON.parse(await readFile(join(workspaceDir, '.oas-vsix-activation.json'), 'utf8'));
      expect(result, 'Extension-host checks must pass against the installed VSIX').toEqual({
        extensionPath: expect.stringContaining(`${installedExtensionsDir}${sep}`)
      });
    }).toPass({ timeout: 60_000 });
  });

  await test.step('verify the validation handler reports invalid input', async () => {
    const notification = await waitForNotification(page, new RegExp(messages.invalid_file_for_generating_oas_doc));
    await expect(notification, 'The packaged validation command must execute').toBeVisible();
  });
});
