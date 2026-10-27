import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'test/fixtures/effect-v4/packedLegacy');
const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'salesforce-effect-v3-packed-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmOptions = { cwd: root, encoding: 'utf8', shell: process.platform === 'win32', timeout: 180000 };

try {
  const packed = JSON.parse(
    execFileSync(
      npm,
      ['pack', path.join(root, 'packages/salesforcedx-vscode-services-types'), '--pack-destination', temp, '--json'],
      npmOptions
    )
  );
  fs.renameSync(path.join(temp, packed[0].filename), path.join(temp, 'services.tgz'));
  for (const file of ['package.json', 'tsconfig.json', 'consumer.ts']) {
    fs.copyFileSync(path.join(fixture, file), path.join(temp, file));
  }
  if (process.argv.includes('--update-lock')) {
    execFileSync(npm, ['install', '--package-lock-only'], { ...npmOptions, cwd: temp, stdio: 'inherit' });
    fs.copyFileSync(path.join(temp, 'package-lock.json'), path.join(fixture, 'package-lock.json'));
  } else {
    const lock = JSON.parse(fs.readFileSync(path.join(fixture, 'package-lock.json'), 'utf8'));
    const packageLock = lock.packages['node_modules/@salesforce/vscode-services'];
    const publishedPackage = JSON.parse(
      fs.readFileSync(path.join(root, 'packages/salesforcedx-vscode-services-types/package.json'), 'utf8')
    );
    assert.deepEqual(
      packageLock.dependencies,
      publishedPackage.dependencies,
      'update the consumer lock when published dependencies change'
    );
    // The local artifact is rebuilt from source; its bytes can differ across OS/npm versions.
    // Registry dependency versions/integrities remain locked and npm ci still validates the artifact.
    packageLock.integrity = packed[0].integrity;
    packageLock.version = packed[0].version;
    fs.writeFileSync(path.join(temp, 'package-lock.json'), JSON.stringify(lock));
  }
  execFileSync(npm, ['ci'], { ...npmOptions, cwd: temp, stdio: 'inherit' });
  const requireConsumer = createRequire(path.join(temp, 'package.json'));
  assert.deepEqual(Object.keys(requireConsumer('@salesforce/vscode-services')), ['ICONS']);
  assert.equal(requireConsumer('effect/package.json').version, '3.21.2');
  const tree = JSON.parse(execFileSync(npm, ['ls', 'effect', '--all', '--json'], { ...npmOptions, cwd: temp }));
  const assertV3Effects = dependencies =>
    Object.entries(dependencies ?? {}).forEach(([name, dependency]) => {
      if (name === 'effect') assert.match(dependency.version, /^3\./, 'legacy install must not require Effect V4');
      assertV3Effects(dependency.dependencies);
    });
  assertV3Effects(tree.dependencies);
  execFileSync(
    process.execPath,
    [path.join(temp, 'node_modules/typescript/bin/tsc'), '-p', path.join(temp, 'tsconfig.json')],
    { cwd: temp, stdio: 'inherit', timeout: 180000 }
  );
  console.log('PASS actual packed legacy services declarations in an independent V3-only installation');
} finally {
  // Only the directory created by this invocation, never another checkout's dependencies.
  fs.rmSync(temp, { recursive: true, force: true });
}
