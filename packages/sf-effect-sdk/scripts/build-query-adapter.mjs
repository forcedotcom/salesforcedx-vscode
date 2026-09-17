import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const sourceCommit = '182db44ffb03d6cb27c433233df17763705034c1';
const sfEffectPath = process.env.SF_EFFECT_PATH;

if (!sfEffectPath) throw new Error('Set SF_EFFECT_PATH to an sf-effect checkout');

const actualCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sfEffectPath, encoding: 'utf8' }).trim();
if (actualCommit !== sourceCommit) {
  throw new Error(`Expected sf-effect ${sourceCommit}; received ${actualCommit}`);
}

const packagePath = dirname(dirname(fileURLToPath(import.meta.url)));
const requireFromSfEffect = createRequire(join(sfEffectPath, 'package.json'));
const effectUrlPath = requireFromSfEffect.resolve('effect/unstable/http/Url');
const sourceImports = {
  '@sf-effect-source/promise': join(sfEffectPath, 'packages/sdk/out/promise.web.js'),
  '@sf-effect-source/promise-runtime': join(sfEffectPath, 'packages/sdk/out/promise.web.runtime.js'),
  '@sf-effect-source/query': join(sfEffectPath, 'packages/sdk/out/query.js'),
  '@sf-effect-source/effect': requireFromSfEffect.resolve('effect/Effect'),
  '@sf-effect-source/schema': requireFromSfEffect.resolve('effect/Schema'),
  '@sf-effect-source/stream': requireFromSfEffect.resolve('effect/Stream')
};

await build({
  entryPoints: [join(packagePath, 'scripts/queryAdapter.entry.mjs')],
  outfile: join(packagePath, 'dist/promise.cjs'),
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  minify: true,
  legalComments: 'eof',
  banner: { js: `/* Generated from forcedotcom/sf-effect commit ${sourceCommit}. Do not edit. */` },
  plugins: [
    // Effect 4 beta always supplies the web worker location as a base, even for an absolute URL.
    {
      name: 'opaque-worker-url-base',
      setup: builder => {
        builder.onLoad({ filter: /\/effect\/dist\/unstable\/http\/Url\.js$/ }, async args => {
          const source = await readFile(args.path, 'utf8');
          const urlConstruction = 'const urlInstance = new URL(url, baseUrl());';
          if (args.path !== effectUrlPath || !source.includes(urlConstruction)) {
            throw new Error(`Could not apply the web worker URL base patch to ${args.path}`);
          }
          return {
            contents: source.replace(
              urlConstruction,
              'const urlInstance = URL.canParse(url) ? new URL(url) : new URL(url, baseUrl());'
            ),
            loader: 'js'
          };
        });
      }
    },
    {
      name: 'sf-effect-source',
      setup: builder => {
        builder.onResolve({ filter: /^@sf-effect-source\// }, args => ({ path: sourceImports[args.path] }));
      }
    }
  ]
});
