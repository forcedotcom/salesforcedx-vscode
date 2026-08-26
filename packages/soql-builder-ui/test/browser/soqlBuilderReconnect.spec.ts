/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import { builder, fromSelect, mountBuilder, selectValue } from './helpers.js';

test('reconnects once, avoids duplicate subscriptions, and cleans up all resources', async ({ page }) => {
  await mountBuilder(page);

  await test.step('ignores a duplicate connect on the mounted element', async () => {
    await page.evaluate(() => window.soqlBuilderHarness.connectAgain());
    await expect
      .poll(() => page.evaluate(() => window.soqlBuilderHarness.stats()))
      .toMatchObject({ acquisitions: 1, activeLayers: 1, activeSubscriptions: 1, releases: 0 });
  });

  await test.step('reconnects once without leaking subscriptions', async () => {
    await page.evaluate(() => window.soqlBuilderHarness.reconnect());
    await expect(builder(page)).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.soqlBuilderHarness.stats()))
      .toMatchObject({ acquisitions: 2, activeLayers: 1, activeSubscriptions: 1, releases: 1 });
  });

  await test.step('keeps action and failure channels live after reconnecting', async () => {
    await selectValue(fromSelect(page), 'Account');
    await expect
      .poll(() => page.evaluate(() => window.soqlBuilderHarness.recordedActions()))
      .toContainEqual({ _tag: 'ObjectSelected', objectName: 'Account' });

    await page.evaluate(() => window.soqlBuilderHarness.fail('Reconnected subscription failed'));
    await expect(page.getByRole('alert')).toHaveText('Reconnected subscription failed');
    await expect
      .poll(() => page.evaluate(() => window.soqlBuilderHarness.stats()))
      .toMatchObject({ acquisitions: 2, activeLayers: 1, activeSubscriptions: 0, releases: 1 });
  });

  await test.step('releases all resources on unmount', async () => {
    await page.evaluate(() => window.soqlBuilderHarness.unmount());
    await expect
      .poll(() => page.evaluate(() => window.soqlBuilderHarness.stats()))
      .toMatchObject({ acquisitions: 2, activeLayers: 0, activeSubscriptions: 0, dispatchesInFlight: 0, releases: 2 });
  });
});
