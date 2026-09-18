/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import baseConfig, { vitestSetupFiles } from '../../config/vitest.base.config.mts';

export default defineConfig({
  ...baseConfig,
  resolve: {
    ...baseConfig.resolve,
    alias: [
      ...(Array.isArray(baseConfig.resolve?.alias) ? baseConfig.resolve.alias : []),
      {
        find: /^(?:\.\.\/)+src(\/.*)?$/,
        replacement: `${fileURLToPath(new URL('./out/src', import.meta.url))}$1`
      }
    ]
  },
  test: {
    ...baseConfig.test,
    include: ['test/**/*.{spec,test}.{ts,tsx}'],
    setupFiles: [...vitestSetupFiles, './test/vitest.setup.ts'],
    mockReset: false,
    server: {
      deps: {
        external: [/\/salesforcedx-apex\/out\/src\//]
      }
    }
  }
});
