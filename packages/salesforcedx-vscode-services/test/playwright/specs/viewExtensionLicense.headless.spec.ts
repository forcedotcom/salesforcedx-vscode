/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { executeCommandWithCommandPalette, waitForVSCodeWorkbench } from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

test('license picker shows installed third-party extensions', async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await executeCommandWithCommandPalette(page, packageNls['extensionLicense.view']);

  const picker = page.getByRole('textbox', { name: 'Select an extension to view its license' });
  await expect(picker).toBeVisible();
  await expect(page.getByRole('option').first()).toBeVisible();

  await picker.fill('salesforcedx-vscode-services');
  await expect(page.getByRole('option').filter({ hasText: 'salesforce.salesforcedx-vscode-services' })).toHaveCount(0);
});
