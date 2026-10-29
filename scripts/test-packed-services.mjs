import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'salesforce-effect-packed-'));
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

const installAndCompile = (fixtureName, directory, packedPackages) => {
  const fixture = path.join(root, 'test/fixtures/effect-v4', fixtureName);
  for (const file of fs
    .readdirSync(fixture)
    .filter(file => file === 'package.json' || file === 'tsconfig.json' || file.endsWith('.ts'))) {
    fs.copyFileSync(path.join(fixture, file), path.join(directory, file));
  }
  const updateLock = process.argv.includes('--update-lock') || process.argv.includes(`--update-lock=${fixtureName}`);
  const lockPath = path.join(fixture, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    for (const { name, publishedPackage, packed } of packedPackages) {
      const packageLock = lock.packages[`node_modules/${name}`];
      if (!updateLock) {
        assert.deepEqual(
          packageLock.dependencies,
          publishedPackage.dependencies,
          `${name}: update the consumer lock when published dependencies change`
        );
      }
      // Only rebuilt local archive metadata changes; registry versions/hashes stay locked.
      packageLock.integrity = packed.integrity;
      packageLock.version = packed.version;
      packageLock.dependencies = publishedPackage.dependencies;
    }
    fs.writeFileSync(path.join(directory, 'package-lock.json'), JSON.stringify(lock));
  } else {
    assert.ok(updateLock, `${fixtureName}: missing committed consumer lock`);
  }
  if (updateLock) {
    // Start from the existing registry lock, updating only what the changed manifests require.
    execFileSync(npm, ['install', '--package-lock-only'], {
      ...npmOptions,
      cwd: directory,
      stdio: 'inherit',
      timeout: 600000
    });
    fs.copyFileSync(path.join(directory, 'package-lock.json'), lockPath);
  }
  execFileSync(npm, ['ci'], { ...npmOptions, cwd: directory, stdio: 'inherit', timeout: 600000 });
  execFileSync(
    process.execPath,
    [path.join(directory, 'node_modules/typescript/bin/tsc'), '-p', path.join(directory, 'tsconfig.json')],
    {
      cwd: directory,
      stdio: 'inherit',
      timeout: 180000
    }
  );
};

try {
  const artifacts = protocols.map(protocol => {
    const directory = path.join(temp, protocol.fixture);
    fs.mkdirSync(directory);
    const publishedDirectory = path.join(root, 'packages', protocol.directory);
    const [packed] = JSON.parse(
      execFileSync(npm, ['pack', publishedDirectory, '--pack-destination', directory, '--json'], npmOptions)
    );
    fs.renameSync(path.join(directory, packed.filename), path.join(directory, 'services.tgz'));
    const publishedPackage = JSON.parse(fs.readFileSync(path.join(publishedDirectory, 'package.json'), 'utf8'));
    return { ...protocol, directory, packed, publishedPackage };
  });

  for (const artifact of artifacts) {
    installAndCompile(artifact.fixture, artifact.directory, [artifact]);
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

  const mixed = path.join(temp, 'packedMixed');
  fs.mkdirSync(mixed);
  for (const artifact of artifacts) {
    fs.copyFileSync(path.join(artifact.directory, 'services.tgz'), path.join(mixed, `${artifact.fixture}.tgz`));
  }
  installAndCompile('packedMixed', mixed, artifacts);
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
