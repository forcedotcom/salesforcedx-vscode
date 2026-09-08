/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { commonConfigBrowser } from '../../../scripts/bundling/web.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempParent = join(packageRoot, 'temp');
mkdirSync(tempParent, { recursive: true });
const consumerRoot = mkdtempSync(join(tempParent, 'packed-web-consumer-'));

try {
  const packResult = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', consumerRoot], {
      cwd: packageRoot,
      encoding: 'utf8',
      env: { ...process.env, npm_config_cache: join(consumerRoot, '.npm-cache') }
    })
  );
  const tarballPath = join(consumerRoot, packResult[0].filename);
  const installedPackage = join(consumerRoot, 'node_modules', '@salesforce', 'apex-node');
  mkdirSync(installedPackage, { recursive: true });
  execFileSync('tar', ['-xzf', tarballPath, '--strip-components=1', '-C', installedPackage]);

  const effectEntry = join(consumerRoot, 'effect-consumer.mjs');
  writeFileSync(
    effectEntry,
    "import { ApexConnectionProvider, ApexOperationError } from '@salesforce/apex-node/effect';\n" +
      'globalThis.apexEffectApi = { ApexConnectionProvider, ApexOperationError };\n'
  );
  await build({
    entryPoints: [effectEntry],
    bundle: true,
    conditions: ['import', 'module', 'default'],
    format: 'esm',
    platform: 'browser',
    write: false
  });

  const fullEntry = join(consumerRoot, 'full-consumer.mjs');
  writeFileSync(
    fullEntry,
    "import { TestService } from '@salesforce/apex-node';\n" +
      "import { ApexConnectionProvider } from '@salesforce/apex-node/effect';\n" +
      'globalThis.apexNodeApi = { TestService, ApexConnectionProvider };\n'
  );
  await build({
    ...commonConfigBrowser,
    entryPoints: [fullEntry],
    sourcemap: false,
    write: false
  });
} finally {
  rmSync(consumerRoot, { recursive: true, force: true });
}
