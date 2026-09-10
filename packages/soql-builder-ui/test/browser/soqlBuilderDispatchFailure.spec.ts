/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import { fromSelect, mountBuilder, selectValue } from './helpers.js';

test('surfaces typed dispatch failures and releases the failed application scope', async ({ page }) => {
  await test.step('arms the next dispatch to fail, then selects an object', async () => {
    await mountBuilder(page);
    await page.evaluate(() => window.soqlBuilderHarness.failNextDispatch('Object selection failed'));
    await selectValue(fromSelect(page), 'Account');
  });

  await test.step('surfaces the failure and releases the application scope', async () => {
    await expect(page.getByRole('alert')).toHaveText('Object selection failed');
    await expect
      .poll(() => page.evaluate(() => window.soqlBuilderHarness.stats()))
      .toMatchObject({ activeLayers: 0, activeSubscriptions: 0, dispatchesInFlight: 0 });
  });
});
