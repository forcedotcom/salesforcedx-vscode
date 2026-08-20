/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'out/src/register.js',
  plugins: [resolve({ browser: true }), terser({ format: { comments: false }, maxWorkers: 1 })],
  output: {
    file: 'dist/app.js',
    format: 'iife',
    name: 'SoqlBuilderUI'
  }
};
