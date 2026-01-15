/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import copy from 'esbuild-plugin-copy';
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { cpSync, mkdirSync } from 'fs';
import * as path from 'path';

// Plugin to rewrite soql-common imports to be relative to dist directory
const rewriteSoqlCommonImports = {
  name: 'rewrite-soql-common-imports',
  setup(build) {
    build.onLoad({ filter: /\.js$/ }, async (args) => {
      const fs = await import('fs');
      let contents = await fs.promises.readFile(args.path, 'utf8');

      // Rewrite imports from ../../soql-common/ to ./soql-common/
      if (contents.includes('../../soql-common/')) {
        contents = contents.replace(
          /require\(["']\.\.\/\.\.\/soql-common\/(soql-parser\.lib[^"']*)["']\)/g,
          'require("./soql-common/$1")'
        );
        contents = contents.replace(
          /require\(["']\.\.\/\.\.\/soql-common\/(soqlComments)["']\)/g,
          'require("./soql-common/$1")'
        );
      }

      return { contents, loader: 'js' };
    });
  }
};

const commonConfig = {
  external: ['vscode', './soql-common/*']
};

await build({
  ...nodeConfig,
  ...commonConfig,
  // the soql extension
  entryPoints: ['./out/src/index.js'],
  outfile: './dist/index.js',
  plugins: [
    rewriteSoqlCommonImports,
    copy({
      assets: {
        from: [`./src/soql-builder-ui/dist/**`],
        to: ['./soql-builder-ui']
      }
    }),
    copy({
      assets: {
        from: ['../../node_modules/@salesforce/soql-data-view/web/**'],
        to: ['./soql-data-view']
      }
    }),
    copy({
      assets: [
        {
          from: ['./out/src/soql-common/**/*'],
          to: ['./soql-common']
        }
      ]
    })
  ]
});

// the language server is a whole other package and we'll need to bundle that separately
await build({
  ...nodeConfig,
  ...commonConfig,
  entryPoints: ['../../node_modules/@salesforce/soql-language-server/lib/server.js'],
  outfile: './dist/server.js'
});

// Manually copy soql-parser.lib directory since esbuild-plugin-copy doesn't handle nested directories well
mkdirSync('./dist/soql-common', { recursive: true });
// Copy from src if out doesn't have it yet (wireit task may not have run)
const soqlParserLibSource = './out/src/soql-common/soql-parser.lib';
const soqlParserLibFallback = './src/soql-common/soql-parser.lib';
try {
  cpSync(soqlParserLibSource, './dist/soql-common/soql-parser.lib', { recursive: true });
} catch (e) {
  console.warn(`Copying from ${soqlParserLibSource} failed, trying ${soqlParserLibFallback}`);
  cpSync(soqlParserLibFallback, './dist/soql-common/soql-parser.lib', { recursive: true });
}
