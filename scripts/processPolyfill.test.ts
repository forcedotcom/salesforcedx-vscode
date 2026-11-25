/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { buildSync } from 'esbuild';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

it('resolves relative browser paths to an absolute root where ancestor searches terminate', () => {
  const browserModule = { exports: {} };
  const bundle = buildSync({
    stdin: {
      contents: `
        import process from 'process';
        import path from 'path-browserify';
        export const cwd = process.cwd();
        export const project = path.resolve('project');
        export const parent = path.resolve(cwd, '..');
        export const grandparent = path.resolve(parent, '..');
      `,
      resolveDir: __dirname
    },
    bundle: true,
    platform: 'browser',
    format: 'cjs',
    write: false,
    inject: [resolve(__dirname, 'bundling/process-global.js')],
    alias: { process: resolve(__dirname, 'bundling/process-polyfill.js') }
  });

  runInNewContext(bundle.outputFiles[0].text, { module: browserModule });

  expect(browserModule.exports).toEqual({
    cwd: '/',
    project: '/project',
    parent: '/',
    grandparent: '/'
  });
});
