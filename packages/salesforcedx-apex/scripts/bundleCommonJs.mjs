/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import assert from 'node:assert/strict';
import { copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
await copyFile('src/effect/package.json', 'out/src/effect/package.json');

// Keep the Promise/class entry CommonJS and /effect native ESM, without either
// entry importing the other module format at runtime.
await Promise.all(
  ['index'].map(async name => {
    const entry = `src/${name}.ts`;
    const result = await build({
      entryPoints: [entry],
      outfile: `out/src/${name}.js`,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22.19',
      keepNames: true,
      sourcemap: true,
      metafile: true,
      packages: 'external',
      plugins: [
        {
          name: 'embed-effect-v4',
          setup: bundler => {
            bundler.onResolve({ filter: /^effect(?:\/|$)/ }, args => ({
              path: require.resolve(args.path, { paths: [args.resolveDir] })
            }));
          }
        }
      ]
    });
    assert(
      Object.values(result.metafile.outputs).every(output =>
        output.imports.every(imported => !imported.external || !/^effect(?:\/|$)/.test(imported.path))
      ),
      `${entry} must not require Effect's ESM entry from the CommonJS bundle`
    );
  })
);

await build({
  entryPoints: ['src/effect/index.ts'],
  outfile: 'out/src/effect/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22.19',
  keepNames: true,
  sourcemap: true,
  packages: 'external'
});
