/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import { createContainerConfig } from '../../../src/config/createContainerConfig';
import { createDesktopConfig } from '../../../src/config/createDesktopConfig';
import { createWebConfig } from '../../../src/config/createWebConfig';

([undefined, 'true'] as const).forEach(ci => {
  test.describe(`screenshot configuration with CI=${ci}`, () => {
    (
      [
        ['web', createWebConfig],
        ['desktop', createDesktopConfig],
        ['container', createContainerConfig]
      ] as const
    ).forEach(([platform, createConfig]) => {
      test(`${platform} disables automatic screenshots without disabling traces`, () => {
        const originalCi = process.env.CI;
        try {
          if (ci) process.env.CI = ci;
          else delete process.env.CI;
          const config = createConfig({ testDir: './specs' });

          expect(config.use?.screenshot, `${platform} should disable runner screenshots`).toBe('off');
          expect(config.use?.trace, `${platform} should retain traces without screenshots`).toEqual({
            mode: platform === 'desktop' || ci ? 'on' : 'on-first-retry',
            screenshots: false
          });
        } finally {
          if (originalCi === undefined) delete process.env.CI;
          else process.env.CI = originalCi;
        }
      });
    });
  });
});
