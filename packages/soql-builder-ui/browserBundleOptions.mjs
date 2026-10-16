/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { commonConfigBrowser } from '../../scripts/bundling/web.mjs';

export const browserBundleOptions = {
  ...commonConfigBrowser,
  entryPoints: ['out/src/register.js'],
  format: 'iife',
  outfile: 'dist/app.js',
  sourcemap: false
};
