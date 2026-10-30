/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, transform } from 'esbuild';
import { commonConfigBrowser } from '../../../scripts/bundling/web.mjs';
import {
  createPackedFixturesDirectory,
  installAndCompileFixtures,
  packServicesPackage
} from '../../../scripts/packedServicesFixtures.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(packageRoot, '../..');
const temp = createPackedFixturesDirectory('apex-packed-consumers-');
const v4 = join(temp, 'apexV4');
const v3 = join(temp, 'apexV3');
const adapterSource = join(root, 'packages/salesforcedx-vscode-services/src/core/executeAnonymousCompat.ts');

try {
  const fixtures = [v4, v3].map(directory => ({
    fixture: directory === v4 ? 'apexV4' : 'apexV3',
    directory,
    packedPackages: [packServicesPackage(packageRoot, directory, 'apex.tgz')]
  }));
  copyFileSync(adapterSource, join(v3, 'executeAnonymousCompat.ts'));
  copyFileSync(join(root, 'test/fixtures/effect-v4/apexV4/root.ts'), join(v4, 'root.cts'));
  await installAndCompileFixtures(fixtures);
  // The root's CommonJS declarations must also work with older Node16 resolution.
  execFileSync(
    process.execPath,
    [
      join(v4, 'node_modules/typescript/bin/tsc'),
      '--ignoreConfig',
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      'false',
      '--module',
      'Node16',
      '--moduleResolution',
      'Node16',
      '--target',
      'ES2023',
      join(v4, 'root.cts')
    ],
    { cwd: v4, stdio: 'inherit', timeout: 180000 }
  );
  const adapter = await transform(readFileSync(adapterSource, 'utf8'), {
    loader: 'ts',
    format: 'esm',
    target: 'node22.0'
  });
  writeFileSync(join(v3, 'executeAnonymousCompat.mjs'), adapter.code);
  execFileSync(process.execPath, [join(v3, 'runtime.mjs')], { cwd: temp, stdio: 'inherit', timeout: 180000 });
  execFileSync(
    join(v4, 'node_modules/node/bin', process.platform === 'win32' ? 'node.exe' : 'node'),
    [join(v4, 'node22.mjs')],
    {
      cwd: v4,
      stdio: 'inherit',
      timeout: 180000
    }
  );

  for (const directory of [v4, v3]) {
    const bundle = await build({
      entryPoints: [join(directory, 'index.ts')],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      conditions: ['import', 'module', 'default'],
      write: false,
      metafile: true
    });
    const inputs = Object.keys(bundle.metafile.inputs);
    assert(
      inputs.some(file =>
        file.replaceAll('\\', '/').includes(`${directory === v4 ? 'apexV4' : 'apexV3'}/node_modules/effect/`)
      )
    );
    assert(inputs.some(file => file.includes('@salesforce/apex-node/out/src/')));
  }
  const fullEntry = join(v4, 'full-consumer.mjs');
  writeFileSync(
    fullEntry,
    "import { TestService } from '@salesforce/apex-node';\n" +
      "import { executeAnonymous } from '@salesforce/apex-node/effect';\n" +
      'globalThis.apexNodeApi = { TestService, executeAnonymous };\n'
  );
  await build({ ...commonConfigBrowser, entryPoints: [fullEntry], sourcemap: false, write: false });
  console.log('PASS isolated packed V3/V4 declarations and browser bundles, including full Apex root');
} finally {
  rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
