/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import { fromSelect, mountBuilder, selectValue } from './helpers.js';

test('cancels a latent action when the component disconnects', async ({ page }) => {
  await test.step('starts a latent dispatch that stays in flight', async () => {
    await mountBuilder(page);
    await page.evaluate(() => window.soqlBuilderHarness.setDispatchLatency(60_000));
    await selectValue(fromSelect(page), 'Account');
    await expect
      .poll(() => page.evaluate(() => window.soqlBuilderHarness.stats()))
      .toMatchObject({ dispatchesInFlight: 1 });
  });

  await test.step('cancels the latent action and releases resources on unmount', async () => {
    await page.evaluate(() => window.soqlBuilderHarness.unmount());

    await expect(page.evaluate(() => window.soqlBuilderHarness.recordedActions())).resolves.toEqual([]);
    await expect(page.evaluate(() => window.soqlBuilderHarness.stats())).resolves.toMatchObject({
      activeLayers: 0,
      activeSubscriptions: 0,
      dispatchesInFlight: 0,
      releases: 1
    });
  });
});
