/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import inject from '@rollup/plugin-inject';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const directory = path.dirname(fileURLToPath(import.meta.url));

const copyHtml = {
  name: 'copy-lit-html',
  writeBundle() {
    mkdirSync(path.join(directory, 'dist-lit'), { recursive: true });
    copyFileSync(path.join(directory, 'lit', 'index.html'), path.join(directory, 'dist-lit', 'index.html'));
  }
};

export default {
  input: path.join(directory, 'lit', 'index.ts'),
  plugins: [
    babel({
      extensions: ['.ts'],
      babelHelpers: 'bundled',
      presets: [['@babel/preset-typescript', { allExtensions: true }]]
    }),
    resolve({ browser: true, extensions: ['.ts', '.mjs', '.js', '.json'] }),
    commonjs(),
    inject({ process: 'process/browser' }),
    terser({ format: { comments: false }, maxWorkers: 1 }),
    copyHtml
  ],
  output: {
    file: path.join(directory, 'dist-lit', 'app.js'),
    format: 'iife',
    name: 'SoqlBuilderUI'
  }
};
