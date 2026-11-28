/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
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

try {
  const fixtures = [
    {
      fixture: 'apexV4',
      directory: v4,
      packedPackages: [
        packServicesPackage(packageRoot, v4, 'apex.tgz'),
        packServicesPackage(join(root, 'packages/salesforcedx-utils'), v4, 'utils.tgz')
      ]
    }
  ];
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
  execFileSync(
    join(v4, 'node_modules/node/bin', process.platform === 'win32' ? 'node.exe' : 'node'),
    [join(v4, 'node22.mjs')],
    {
      cwd: v4,
      stdio: 'inherit',
      timeout: 180000
    }
  );

  const bundle = await build({
    entryPoints: [join(v4, 'index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    conditions: ['import', 'module', 'default'],
    write: false,
    metafile: true
  });
  const inputs = Object.keys(bundle.metafile.inputs);
  assert(inputs.some(file => file.replaceAll('\\', '/').includes('apexV4/node_modules/effect/')));
  assert(inputs.some(file => file.includes('@salesforce/apex-node/out/src/')));
  const fullEntry = join(v4, 'full-consumer.mjs');
  writeFileSync(
    fullEntry,
    "import { FileOutput, FileOutputError, writeResultFiles } from '@salesforce/apex-node/effect';\n" +
      "import * as Effect from 'effect/Effect';\n" +
      "import * as Stream from 'effect/Stream';\n" +
      'const files = new Map();\n' +
      'const fileOutput = {\n' +
      '  createDirectory: () => Effect.void,\n' +
      '  writeFile: (directory, fileName, content) => content.pipe(\n' +
      '    Stream.mkString,\n' +
      '    Effect.flatMap(text => {\n' +
      '      const path = `${directory}/${fileName}`;\n' +
      "      if (fileName === 'missing/extra.txt') return Effect.fail(new FileOutputError({ operation: 'writeFile', path, message: 'missing parent directory' }));\n" +
      '      files.set(path, text);\n' +
      '      return Effect.succeed(path);\n' +
      '    })\n' +
      '  )\n' +
      '};\n' +
      'const write = (result, outputDirConfig) => writeResultFiles(result, outputDirConfig).pipe(\n' +
      '  Effect.provideService(FileOutput, fileOutput), Effect.result, Effect.runPromise\n' +
      ');\n' +
      'globalThis.apexNodeApi = { files, write };\n'
  );
  const fullBundle = await build({
    ...commonConfigBrowser,
    entryPoints: [fullEntry],
    format: 'iife',
    sourcemap: false,
    write: false
  });
  const browser = {
    AbortController,
    Error,
    URL,
    TextEncoder,
    TextDecoder,
    setTimeout,
    clearTimeout
  };
  runInNewContext(fullBundle.outputFiles[0].text, browser);
  const api = browser.apexNodeApi;
  const successful = await api.write(
    { testRunId: '707000000000001AAA' },
    { dirPath: '/reports', fileInfos: [{ filename: 'extra.txt', content: 'résultats 🦊\r\n' }] }
  );
  assert.equal(successful._tag, 'Success');
  assert.deepEqual(Array.from(successful.success), ['/reports/test-run-id.txt', '/reports/extra.txt']);
  assert.equal(api.files.get('/reports/test-run-id.txt'), '707000000000001AAA');
  assert.equal(api.files.get('/reports/extra.txt'), 'résultats 🦊\r\n');

  const partial = await api.write(
    { testRunId: '707000000000002AAA' },
    { dirPath: '/partial', fileInfos: [{ filename: 'missing/extra.txt', content: 'missing parent directory' }] }
  );
  assert.equal(partial._tag, 'Failure');
  assert.equal(partial.failure._tag, 'PartialResultFilesError');
  assert.equal(partial.failure.cause._tag, 'FileOutputError');
  assert.deepEqual(Array.from(partial.failure.writtenFiles), ['/partial/test-run-id.txt']);
  assert.equal(api.files.get('/partial/test-run-id.txt'), '707000000000002AAA');
  console.log('PASS isolated packed V4 declarations and browser FileOutput behavior');
} finally {
  rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
