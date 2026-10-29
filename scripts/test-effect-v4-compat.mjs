import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = path.join(root, 'test/fixtures/effect-v4');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const name of ['provider', 'consumer', 'v4']) {
  execFileSync(npm, ['ci', '--prefix', path.join(fixtures, name)], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    timeout: 120000
  });
}
for (const name of ['consumer', 'v4']) {
  execFileSync(
    process.execPath,
    [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(fixtures, name)],
    { cwd: root, stdio: 'inherit', timeout: 120000 }
  );
}
execFileSync(process.execPath, ['--import', 'tsx', path.join(fixtures, 'consumer/index.ts')], {
  cwd: root,
  stdio: 'inherit',
  timeout: 120000
});

const cli = path.join(root, 'node_modules/@effect/language-service/cli.js');
const severity = JSON.parse(fs.readFileSync(path.join(root, 'config/effect-diagnostics.json'), 'utf8')).enforcedRules;
const diagnostics = spawnSync(
  process.execPath,
  [
    cli,
    'diagnostics',
    '--project',
    path.join(fixtures, 'v4/tsconfig.json'),
    '--format',
    'json',
    '--lspconfig',
    JSON.stringify({ diagnosticSeverity: Object.fromEntries(severity.map(rule => [rule, 'error'])) })
  ],
  { cwd: root, encoding: 'utf8', timeout: 120000 }
);
assert.equal(diagnostics.error, undefined);
const findings = JSON.parse(diagnostics.stdout).diagnostics;
for (const rule of ['floatingEffect', 'anyUnknownInErrorContext', 'runEffectInsideEffect']) {
  assert.ok(
    findings.some(finding => finding.name === rule && finding.file.endsWith('negative.ts')),
    `V4 ${rule} must report`
  );
}
for (const channel of ['error channel', 'requirements channel']) {
  assert.ok(findings.some(finding => finding.name === 'anyUnknownInErrorContext' && finding.message.includes(channel)));
}
assert.equal(
  findings.filter(finding => severity.includes(finding.name) && finding.file.endsWith('positive.ts')).length,
  0
);
const gate = spawnSync(
  process.execPath,
  [path.join(root, 'scripts/effect-diagnostics.mjs'), path.join(fixtures, 'v4')],
  { cwd: root, encoding: 'utf8', timeout: 360000 }
);
assert.equal(gate.status, 1, gate.stdout + gate.stderr);
assert.match(gate.stdout, /floatingEffect/);
const positive = spawnSync(
  process.execPath,
  [path.join(root, 'scripts/effect-diagnostics.mjs'), path.join(fixtures, 'v4/positive')],
  { cwd: root, encoding: 'utf8', timeout: 360000 }
);
assert.equal(positive.status, 0, positive.stdout + positive.stderr);
assert.match(positive.stdout, /0 skipped, 0 failed, 0 enforced violation/);
console.log(
  'PASS V4 CLI and repository gate reject intentional violations; Context.Service positive has no enforced findings'
);

const requireV4 = createRequire(path.join(fixtures, 'v4/package.json'));
assert.equal(requireV4('effect/package.json').version, '4.0.6');
for (const packageName of ['@effect/platform-node', '@effect/opentelemetry']) {
  assert.equal(requireV4(`${packageName}/package.json`).version, '4.0.6');
  const packageRequire = createRequire(requireV4.resolve(`${packageName}/package.json`));
  assert.equal(packageRequire('effect/package.json').version, '4.0.6');
}
const invalid = spawnSync(
  process.execPath,
  [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(fixtures, 'v4/invalid')],
  { cwd: root, encoding: 'utf8', timeout: 120000 }
);
assert.equal(invalid.status, 2, invalid.stdout + invalid.stderr);
assert.match(invalid.stdout, /MissingConfig/);
assert.match(invalid.stdout, /NeedsConfig/);
const mixedRuntime = spawnSync(process.execPath, [path.join(fixtures, 'consumer/rawV4Layer.mjs')], {
  cwd: root,
  encoding: 'utf8',
  timeout: 10000
});
assert.notEqual(mixedRuntime.status, 0);
assert.match(mixedRuntime.stderr, /TypeError/);
for (const platform of ['node', 'browser']) {
  const bundle = await esbuild.build({
    entryPoints: [path.join(fixtures, 'v4/positive.ts')],
    bundle: true,
    platform,
    format: 'esm',
    write: false,
    metafile: true
  });
  assert.ok(Object.keys(bundle.metafile.inputs).some(file => file.includes('effect/')));
  const bundled = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
  );
  assert.equal(bundled.connection, 'v4');
  const legacy = await esbuild.build({
    entryPoints: [path.join(fixtures, 'consumer/bundled.ts')],
    bundle: true,
    platform,
    format: 'esm',
    write: false,
    metafile: true
  });
  const inputs = Object.keys(legacy.metafile.inputs);
  assert.ok(inputs.some(file => file.includes('consumer/node_modules/effect/')));
  assert.ok(inputs.some(file => file.includes('provider/node_modules/effect/')));
  assert.ok(inputs.every(file => !file.includes('v4/node_modules/')));
  const legacyBundle = await import(
    `data:text/javascript;base64,${Buffer.from(legacy.outputFiles[0].text).toString('base64')}`
  );
  assert.equal(legacyBundle.connection.marker, 'bundled-v3');
}
console.log(
  'PASS V3/V4 Node/browser bundle isolation and execution; invalid layer dependencies and raw cross-major mixing rejected'
);
