/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from '@playwright/test';
import { executeCommandWithCommandPalette } from '../../../src/pages/commands';
import { hideSecondarySideBar } from '../../../src/pages/nativeCommands';
import { closeWelcomeTabs, waitForVSCodeWorkbench } from '../../../src/utils/helpers';
import { ensureSecondarySideBarHidden } from '../../../src/utils/workflows';
import { test } from '../fixtures/index';

test('secondary sidebar hiding handles visible and already-hidden states', async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await executeCommandWithCommandPalette(page, 'View: Toggle Secondary Side Bar Visibility');
  const auxiliaryBar = page.locator('.part.auxiliarybar');
  await expect(auxiliaryBar).toBeVisible();
  await hideSecondarySideBar(page);
  await expect(auxiliaryBar).toBeHidden();
  await hideSecondarySideBar(page);
  await expect(auxiliaryBar).toBeHidden();
});
