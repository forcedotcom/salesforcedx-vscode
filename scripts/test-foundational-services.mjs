import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { commonConfigBrowser } from './bundling/web.mjs';
import {
  createPackedFixturesDirectory,
  installAndCompileFixtures,
  packServicesPackage
} from './packedServicesFixtures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = createPackedFixturesDirectory('salesforce-v4-foundations-');
const directory = path.join(temp, 'foundations');
const cli = path.join(root, 'node_modules/@effect/language-service/cli.js');

try {
  const packedPackages = [
    packServicesPackage(path.join(root, 'packages/salesforcedx-vscode-services-v3-compat'), directory, 'compat.tgz'),
    packServicesPackage(path.join(root, 'packages/salesforcedx-vscode-services-v2'), directory, 'v2.tgz'),
    packServicesPackage(
      path.join(root, 'packages/salesforcedx-vscode-services-v4-implementation'),
      directory,
      'implementation.tgz'
    )
  ];
  await installAndCompileFixtures([{ fixture: 'foundations', directory, packedPackages }]);
  const require = createRequire(path.join(directory, 'package.json'));
  const implementationRequire = createRequire(
    path.join(directory, 'node_modules/@salesforce/vscode-services-v4-implementation/package.json')
  );
  assert.equal(require('effect/package.json').version, '4.0.6');
  assert.equal(require.resolve('effect/Effect'), implementationRequire.resolve('effect/Effect'));

  fs.copyFileSync(path.join(directory, 'cjsConsumer.ts'), path.join(directory, 'cjsConsumer.cts'));
  const commonJs = spawnSync(
    process.execPath,
    [
      path.join(directory, 'node_modules/typescript/bin/tsc'),
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
      'ES2024',
      path.join(directory, 'cjsConsumer.cts')
    ],
    { cwd: directory, encoding: 'utf8', timeout: 180000 }
  );
  assert.equal(commonJs.error, undefined);
  assert.equal(
    commonJs.status,
    0,
    `CommonJS URI-helper consumer must compile under Node16 resolution: ${commonJs.stdout}${commonJs.stderr}`
  );

  fs.writeFileSync(
    path.join(directory, 'tsconfig.negative.json'),
    JSON.stringify({
      extends: './tsconfig.json',
      include: ['negative.ts']
    })
  );
  const negative = spawnSync(
    process.execPath,
    [path.join(directory, 'node_modules/typescript/bin/tsc'), '-p', path.join(directory, 'tsconfig.negative.json')],
    {
      cwd: directory,
      encoding: 'utf8',
      timeout: 180000
    }
  );
  assert.equal(negative.error, undefined);
  assert.notEqual(negative.status, 0, 'missing foundational dependencies must fail TypeScript');
  assert.match(negative.stdout, /WebFileSystemProvider/);
  assert.match(negative.stdout, /ChannelService/);
  assert.doesNotMatch(negative.stdout, /Cannot find module/);

  const enforced = JSON.parse(fs.readFileSync(path.join(root, 'config/effect-diagnostics.json'), 'utf8')).enforcedRules;
  const diagnosticRun = spawnSync(
    process.execPath,
    [
      cli,
      'diagnostics',
      '--project',
      path.join(directory, 'tsconfig.json'),
      '--format',
      'json',
      '--lspconfig',
      JSON.stringify({ diagnosticSeverity: Object.fromEntries(enforced.map(rule => [rule, 'error'])) })
    ],
    { cwd: root, encoding: 'utf8', timeout: 180000 }
  );
  assert.equal(diagnosticRun.error, undefined);
  assert.notEqual(diagnosticRun.status, 0, 'negative V4 diagnostic controls must fail the CLI');
  const diagnostics = JSON.parse(diagnosticRun.stdout);
  for (const name of ['floatingEffect', 'runEffectInsideEffect']) {
    assert(
      diagnostics.diagnostics.some(finding => finding.name === name && finding.file.endsWith('diagnostics.ts')),
      `V4 ${name} control must report`
    );
  }
  assert.deepEqual(
    diagnostics.diagnostics
      .filter(finding => finding.file.endsWith('positive.ts'))
      .map(({ name, message }) => ({ name, message })),
    [],
    'positive foundational graph must have clean LS diagnostics'
  );
  console.log(
    'PASS strict packed foundation declarations, actual V4 diagnostics controls and missing-layer negative controls'
  );

  const vscodeHost = {
    name: 'foundation-test-vscode-host',
    setup: bundler => {
      bundler.onResolve({ filter: /^vscode$/ }, () => ({ path: path.join(directory, 'vscode.mjs') }));
    }
  };
  for (const platform of ['node', 'browser']) {
    const outfile = path.join(directory, `${platform}-bundle.mjs`);
    const result = await build({
      ...(platform === 'browser' ? commonConfigBrowser : {}),
      entryPoints: [path.join(directory, 'runtime.mjs')],
      outfile,
      bundle: true,
      format: 'esm',
      platform,
      target: 'es2024',
      sourcemap: false,
      metafile: true,
      external:
        platform === 'node' ? ['@salesforce/core', '@salesforce/core/*', 'effect', 'effect/*', 'vscode-uri'] : [],
      plugins: [...(platform === 'browser' ? (commonConfigBrowser.plugins ?? []) : []), vscodeHost]
    });
    assert(
      Object.keys(result.metafile.inputs).some(file => file.includes('vscode-services-v4-implementation/out/')),
      'bundle must use the actual packed implementation'
    );
    const dom =
      platform === 'browser'
        ? new (require('jsdom').JSDOM)('<!doctype html>', { url: 'https://fixture.example/' })
        : undefined;
    const previous = new Map();
    if (dom) {
      for (const name of ['window', 'document', 'navigator']) {
        previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
      }
    }
    try {
      const { observed } = await import(pathToFileURL(outfile).href);
      assert.deepEqual(observed, {
        workspaceWatchers: 1,
        workspaceDisposed: 1,
        settingsWatchers: 1,
        settingsDisposed: 1,
        path: 'memfs:/fixture',
        token: '<redacted>',
        aliases: ['fixture-alias'],
        files: [`memfs:/fixture/${platform === 'browser' ? 'web' : 'desktop'}-result.cls`],
        orgRefClosed: true
      });
      console.log(`PASS actual packed ${platform}-target foundation graph`);
    } finally {
      if (dom) {
        for (const [name, descriptor] of previous) {
          if (descriptor) Object.defineProperty(globalThis, name, descriptor);
          else delete globalThis[name];
        }
        dom.window.close();
      }
    }
  }
  console.log(
    'PASS real packed foundation graph in Node/browser-target bundles: scoped singletons, backend selection, redaction and teardown (browser bundle executes under Node, not VS Code E2E)'
  );
} catch (error) {
  console.error('Foundation services check failed:', error);
  process.exitCode = 1;
} finally {
  fs.rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
