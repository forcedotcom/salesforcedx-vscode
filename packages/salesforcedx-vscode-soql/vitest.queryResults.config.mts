/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { defineConfig } from 'vitest/config';
import baseConfig from '../../config/vitest.base.config.mts';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    environment: 'jsdom',
    include: ['test/jest/queryDataView/queryDataViewController.test.ts'],
    exclude: [...(baseConfig.test?.exclude ?? []), '.wireit/**'],
    reporters: ['default', ['junit', { outputFile: 'junit-custom-queryResults-unitTests.xml' }]]
  }
});
