import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { installAndCompileFixtures, packServicesPackage } from './packedServicesFixtures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'salesforce-effect-bridge-'));
const host = path.join(temp, 'bridgeHost');
const consumer = path.join(temp, 'bridgeConsumer');

try {
  const artifacts = [
    packServicesPackage(path.join(root, 'packages/salesforcedx-vscode-services-v3-compat'), host, 'v3.tgz'),
    packServicesPackage(path.join(root, 'packages/salesforcedx-vscode-services-v2'), host, 'v2.tgz')
  ];
  fs.mkdirSync(consumer);
  await installAndCompileFixtures([
    { fixture: 'bridgeHost', directory: host, packedPackages: artifacts },
    { fixture: 'bridgeConsumer', directory: consumer, packedPackages: [] }
  ]);
  execFileSync(process.execPath, ['--import', 'tsx', path.join(consumer, 'index.ts')], {
    cwd: root,
    stdio: 'inherit',
    timeout: 180000
  });
  execFileSync(process.execPath, ['--import', 'tsx', path.join(consumer, 'invalidHost.mjs')], {
    cwd: root,
    stdio: 'inherit',
    timeout: 180000
  });

  const sdkHelper = await esbuild.transform(fs.readFileSync(path.join(host, 'nodeConnection.ts'), 'utf8'), {
    loader: 'ts',
    format: 'esm',
    target: 'node24'
  });
  const sdkHelperPath = path.join(host, 'nodeConnection.mjs');
  fs.writeFileSync(sdkHelperPath, sdkHelper.code);
  const { createOfflineConnection } = await import(pathToFileURL(sdkHelperPath).href);
  for (const platform of ['node', 'browser']) {
    const bundle = await esbuild.build({
      entryPoints: [path.join(consumer, 'browser.ts')],
      bundle: true,
      platform,
      format: 'esm',
      write: false,
      metafile: true
    });
    const inputs = Object.keys(bundle.metafile.inputs);
    assert.ok(
      inputs.some(file => file.includes('bridgeConsumer/node_modules/effect/')),
      'independent V3 consumer runtime must be bundled'
    );
    assert.ok(
      inputs.some(file => file.includes('vscode-services-v3-compat/node_modules/effect/')),
      'actual adapter owns its pinned V3 runtime'
    );
    assert.ok(
      inputs.some(file => file.includes('bridgeHost/node_modules/effect/')),
      'one V4 host runtime must be bundled'
    );
    const bundled = await import(
      `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
    );
    assert.equal(bundled.observed.failureTag, 'NoTargetOrgConfiguredError');
    assert.equal(bundled.observed.graphBuilds, 1);
    assert.equal(bundled.observed.graphDisposals, 1);
    assert.equal(bundled.observed.subscribersAfterClose, 0);
    assert.deepEqual(
      bundled.observed.updates,
      Array.from({ length: 2 }, () => ['00D000000000002', '00D000000000003', '00D000000000004', '00D000000000005'])
    );
    if (platform === 'node') {
      assert.equal((await bundled.basicConformance(await createOfflineConnection())).sameConnection, true);
    }
  }
  console.log(
    'PASS actual packed V3 bridge Node/browser bundle isolation and basic conformance; browser-target bundles execute under Node'
  );
} catch (error) {
  console.error('V3 bridge check failed:', error);
  process.exitCode = 1;
} finally {
  try {
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (error) {
    console.error('V3 bridge cleanup failed:', error);
    process.exitCode = 1;
  }
}
