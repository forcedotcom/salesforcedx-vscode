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
    include: ['**/jest/**/*.{spec,test}.{ts,tsx}']
  }
});
