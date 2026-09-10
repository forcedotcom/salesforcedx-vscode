/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { build } from 'esbuild';
import { commonConfigBrowser } from '../../../../scripts/bundling/web.mjs';

await build({
  ...commonConfigBrowser,
  entryPoints: ['.test-dist/browser-compiled/test/browser/fixture.js'],
  format: 'iife',
  minify: false,
  outfile: '.test-dist/browser/fixture.js',
  sourcemap: false
});
