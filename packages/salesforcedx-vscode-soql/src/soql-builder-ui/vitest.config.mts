/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import lwc from '@lwc/rollup-plugin';
import { babel } from '@rollup/plugin-babel';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const soqlBuilderUiRoot = path.resolve(process.cwd(), 'src/soql-builder-ui');
const lwcPlugin = lwc({
  rootDir: soqlBuilderUiRoot,
  modules: [{ dir: 'modules' }],
  include: ['**/modules/**']
});
const { transform: lwcTransform, ...lwcResolutionPlugin } = lwcPlugin;

export default defineConfig({
  plugins: [
    {
      ...babel({
        extensions: ['.ts'],
        babelHelpers: 'bundled',
        plugins: [['@babel/plugin-syntax-decorators', { legacy: true }]],
        presets: [['@babel/preset-typescript', { allExtensions: true }]]
      }),
      enforce: 'pre'
    },
    {
      name: `${lwcPlugin.name}-transform`,
      transform: lwcTransform,
      enforce: 'pre'
    },
    lwcResolutionPlugin
  ],
  resolve: {
    alias: [
      {
        find: /^lwc$/,
        replacement: path.resolve(process.cwd(), 'node_modules/@lwc/engine-dom/dist/index.js')
      },
      { find: /^querybuilder\/messages$/, replacement: path.resolve(soqlBuilderUiRoot, 'modules/querybuilder/messages/i18n.ts') },
      {
        find: /^querybuilder\/(\w+)$/,
        replacement: path.resolve(soqlBuilderUiRoot, 'modules/querybuilder/$1/$1.ts')
      }
    ]
  },
  test: {
    name: 'soql-builder-ui',
    environment: 'jsdom',
    globals: true,
    include: ['test/unit/soql-builder-ui/**/*.{spec,test}.{ts,js}'],
    setupFiles: [path.resolve(soqlBuilderUiRoot, 'testSetup/setupTests.ts')],
    reporters: ['verbose', ['junit', { outputFile: 'junit-custom-soqlBuilder-unitTests.xml' }]]
  }
});
