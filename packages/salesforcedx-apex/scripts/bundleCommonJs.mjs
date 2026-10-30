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

// Node 22.0 cannot require ESM. Embed V4 only in the Promise/class entries;
// /effect remains native ESM using the installed V4 dependency.
await Promise.all(
  ['index', 'executeAnonymousCompat'].map(async name => {
    const entry = `src/${name}.ts`;
    const result = await build({
      entryPoints: [entry],
      outfile: `out/src/${name}.js`,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22.0',
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
      `${entry} must not require Effect's ESM entry on Node 22.0`
    );
  })
);
