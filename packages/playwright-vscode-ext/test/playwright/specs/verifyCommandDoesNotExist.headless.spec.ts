/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { verifyCommandDoesNotExist } from '../../../src/pages/commands';
import { waitForVSCodeWorkbench, assertWelcomeTabExists, closeWelcomeTabs } from '../../../src/utils/helpers';
import { test } from '../fixtures/index';

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
  });

  test('should verify nonsense command does not exist', async ({ page }) => {
    await test.step('Verify nonsense command does not exist in command palette', async () => {
      // Use a clearly nonsense command that should never exist
      await verifyCommandDoesNotExist(page, 'SFDX: This Command Definitely Does Not Exist 12345');
    });
  });
});
