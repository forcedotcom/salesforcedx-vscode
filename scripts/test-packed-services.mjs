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
    endpoint: '@salesforce/vscode-services',
    version: '3.21.2'
  },
  {
    fixture: 'packedV2',
    directory: 'salesforcedx-vscode-services-types',
    name: '@salesforce/vscode-services',
    endpoint: '@salesforce/vscode-services/v2',
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
  fs.copyFileSync(artifacts[0].archive, path.join(mixed, 'packedLegacy.tgz'));
  await installAndCompileFixtures([
    ...artifacts.map(artifact => ({
      fixture: artifact.fixture,
      directory: artifact.directory,
      packedPackages: [artifact]
    })),
    { fixture: 'packedMixed', directory: mixed, packedPackages: [artifacts[0]] }
  ]);

  for (const artifact of artifacts) {
    const requireConsumer = createRequire(path.join(artifact.directory, 'package.json'));
    assert.equal(requireConsumer('effect/package.json').version, artifact.version);
    const requireServices = createRequire(requireConsumer.resolve(artifact.name));
    assert.equal(requireServices('effect/package.json').version, '4.0.6');
    assert.equal(requireServices('effect-v3/package.json').version, '3.21.2');
    assert.ok(!Object.keys(artifact.publishedPackage.dependencies).includes('@salesforce/vscode-services-v3-compat'));
    const declarations = fs.readFileSync(
      path.join(artifact.directory, 'node_modules/@salesforce/vscode-services/out/services.d.ts'),
      'utf8'
    );
    assert.doesNotMatch(declarations, /@effect\/|vscode-services-v3-compat|from\s+["']effect\//);
    // Both majors are intentional dependencies; npm must still report a valid peer/dependency tree.
    execFileSync(npm, ['ls', '--all', '--json'], { ...npmOptions, cwd: artifact.directory });
    if (artifact.fixture === 'packedLegacy') {
      assert.deepEqual(Object.keys(requireConsumer(artifact.name)), ['ICONS']);
      for (const platform of ['node', 'browser']) {
        const bundle = await esbuild.build({
          entryPoints: [path.join(artifact.directory, 'runtime.ts')],
          bundle: true,
          platform,
          format: 'esm',
          write: false,
          metafile: true
        });
        const inputs = Object.keys(bundle.metafile.inputs);
        const v4Directory = path.dirname(requireServices.resolve('effect/package.json'));
        assert.ok(
          inputs.every(
            file => !path.resolve(root, file).startsWith(`${v4Directory}${path.sep}`) && !file.includes('/out/v2/')
          ),
          'unversioned root must not load V4 contracts or its runtime'
        );
        const result = await import(
          `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}#root-${platform}`
        );
        assert.equal(result.observed, '$(sf-org-leaf)');
      }
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
        const legacyEffectDirectory = path.dirname(requireServices.resolve('effect-v3/package.json'));
        assert.ok(
          Object.keys(bundle.metafile.inputs).every(
            file => !path.resolve(root, file).startsWith(`${legacyEffectDirectory}${path.sep}`)
          ),
          '/v2 must not load the package-owned V3 runtime'
        );
        assert.equal(
          requireServices.resolve('effect/Schema'),
          requireConsumer.resolve('effect/Schema'),
          '/v2 and a consumer in this installation must resolve the same ordinary V4 copy'
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
      `PASS actual packed ${artifact.endpoint} declarations and bundle isolation with independent consumer Effect ${artifact.version}`
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
