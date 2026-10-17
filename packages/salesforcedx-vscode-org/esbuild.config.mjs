/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { readFile, writeFile } from 'fs/promises';

// CJS workspace outputs retain require('vscode') and require('node:*') calls. Rewrite those
// external imports so this ESM bundle doesn't need esbuild's unsupported dynamic-require shim.
const cjsExternalImportPlugin = {
  name: 'cjs-external-import',
  setup(build) {
    build.onLoad({ filter: /[\\/]packages[\\/][^\\/]+[\\/]out[\\/].*\.js$/ }, async args => {
      const contents = await readFile(args.path, 'utf8');
      const transformed = contents.replace(
        /(?:const|let|var)\s+([\w$]+)\s*=\s*require\((["'])(vscode|node:[^"']+)\2\);/g,
        (_match, binding, _quote, moduleName) => `import * as ${binding} from '${moduleName}';`
      );
      return transformed === contents ? undefined : { contents: transformed, loader: 'js' };
    });
  }
};

const nodeBuild = await build({
  ...nodeConfig,
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  supported: { ...nodeConfig.supported, 'dynamic-import': true },
  entryPoints: ['./out/src/index.js'],
  outdir: './dist',
  plugins: [...(nodeConfig.plugins ?? []), cjsExternalImportPlugin],
  metafile: true
});

await writeFile('dist/node-metafile.json', JSON.stringify(nodeBuild.metafile, null, 2));
