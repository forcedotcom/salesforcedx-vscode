import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import {
  createPackedFixturesDirectory,
  installAndCompileFixtures,
  packServicesPackage
} from './packedServicesFixtures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = createPackedFixturesDirectory('salesforce-effect-packed-');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmOptions = { cwd: root, encoding: 'utf8', shell: process.platform === 'win32', timeout: 180000 };
const protocols = [
  {
    fixture: 'packedLegacy',
    directory: 'salesforcedx-vscode-services-types',
    name: '@salesforce/vscode-services',
    version: '3.21.2'
  },
  {
    fixture: 'packedV2',
    directory: 'salesforcedx-vscode-services-v2',
    name: '@salesforce/vscode-services-v2',
    version: '4.0.6'
  }
];

try {
  const artifacts = protocols.map(protocol => {
    const directory = path.join(temp, protocol.fixture);
    const publishedDirectory = path.join(root, 'packages', protocol.directory);
    const artifact = packServicesPackage(publishedDirectory, directory, 'services.tgz');
    assert.equal(artifact.name, protocol.name);
    return { ...protocol, ...artifact };
  });

  const mixed = path.join(temp, 'packedMixed');
  fs.mkdirSync(mixed);
  for (const artifact of artifacts) {
    fs.copyFileSync(path.join(artifact.directory, 'services.tgz'), path.join(mixed, `${artifact.fixture}.tgz`));
  }
  await installAndCompileFixtures([
    ...artifacts.map(artifact => ({
      fixture: artifact.fixture,
      directory: artifact.directory,
      packedPackages: [artifact]
    })),
    { fixture: 'packedMixed', directory: mixed, packedPackages: artifacts }
  ]);

  for (const artifact of artifacts) {
    const requireConsumer = createRequire(path.join(artifact.directory, 'package.json'));
    assert.equal(requireConsumer('effect/package.json').version, artifact.version);
    const tree = JSON.parse(
      execFileSync(npm, ['ls', 'effect', '--all', '--json'], { ...npmOptions, cwd: artifact.directory })
    );
    const assertEffectVersion = dependencies =>
      Object.entries(dependencies ?? {}).forEach(([name, dependency]) => {
        if (name === 'effect')
          assert.equal(dependency.version, artifact.version, `${artifact.fixture}: unintended Effect runtime`);
        assertEffectVersion(dependency.dependencies);
      });
    assertEffectVersion(tree.dependencies);
    if (artifact.fixture === 'packedLegacy') {
      assert.deepEqual(Object.keys(requireConsumer(artifact.name)), ['ICONS']);
    } else {
      for (const platform of ['node', 'browser']) {
        const bundle = await esbuild.build({
          entryPoints: [path.join(artifact.directory, 'runtime.ts')],
          bundle: true,
          platform,
          format: 'esm',
          write: false,
          metafile: true
        });
        assert.ok(Object.keys(bundle.metafile.inputs).some(file => file.includes('node_modules/effect/')));
        assert.ok(
          Object.keys(bundle.metafile.inputs).every(file => !file.includes('node_modules/@salesforce/vscode-services/'))
        );
        const result = await import(
          `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
        );
        assert.deepEqual(result.observed, {
          aliases: ['configured-alias'],
          target: 'configured-alias',
          orgIds: ['00D000000000001'],
          failureTag: 'NoTargetOrgConfiguredError'
        });
      }
    }
    console.log(
      `PASS actual packed ${artifact.name} declarations in an independent Effect ${artifact.version}-only installation`
    );
  }

  console.log('PASS actual packed V3/V4 public contracts reject cross-major Effects, Contexts, Layers and refs');
} catch (error) {
  console.error('Packed services check failed:', error);
  process.exitCode = 1;
} finally {
  try {
    // Only this invocation's directory. Retry transient Windows file locks.
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (error) {
    console.error('Packed services cleanup failed:', error);
    process.exitCode = 1;
  }
}
