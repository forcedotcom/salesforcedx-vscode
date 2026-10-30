import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmOptions = { cwd: root, encoding: 'utf8', shell: process.platform === 'win32', timeout: 180000 };
const execFileAsync = promisify(execFile);

const runCommand = async (file, args, options) => {
  try {
    const result = await execFileAsync(file, args, options);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
};

const finishAll = async (promises, phase) => {
  // Do not clean up while a sibling install/typecheck still owns files in its directory.
  const results = await Promise.allSettled(promises);
  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length > 0) throw new AggregateError(failures, `Packed fixture ${phase} failed`);
};

export const packServicesPackage = (packageDirectory, directory, archiveName) => {
  fs.mkdirSync(directory, { recursive: true });
  const [packed] = JSON.parse(
    execFileSync(npm, ['pack', packageDirectory, '--pack-destination', directory, '--json'], npmOptions)
  );
  const archive = path.join(directory, archiveName);
  fs.renameSync(path.join(directory, packed.filename), archive);
  const publishedPackage = JSON.parse(fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'));
  return { name: publishedPackage.name, directory, archive, packed, publishedPackage };
};

const installFixture = async ({ fixture: fixtureName, directory, packedPackages }) => {
  const fixture = path.join(root, 'test/fixtures/effect-v4', fixtureName);
  for (const file of fs
    .readdirSync(fixture)
    .filter(
      file => file === 'package.json' || file === 'tsconfig.json' || file.endsWith('.ts') || file.endsWith('.mjs')
    )) {
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
      // Refresh only rebuilt local archive metadata, leaving registry identities untouched.
      packageLock.integrity = packed.integrity;
      packageLock.version = packed.version;
      packageLock.dependencies = publishedPackage.dependencies;
    }
    fs.writeFileSync(path.join(directory, 'package-lock.json'), JSON.stringify(lock));
  } else {
    assert.ok(updateLock, `${fixtureName}: missing committed consumer lock`);
  }
  if (updateLock) {
    // Existing registry versions/hashes survive unless changed dependencies require an update.
    await runCommand(npm, ['install', '--package-lock-only'], {
      ...npmOptions,
      cwd: directory,
      timeout: 600000
    });
    fs.copyFileSync(path.join(directory, 'package-lock.json'), lockPath);
  }
  await runCommand(npm, ['ci'], { ...npmOptions, cwd: directory, timeout: 600000 });
};

export const installAndCompileFixtures = async fixtures => {
  await finishAll(fixtures.map(installFixture), 'installation');
  // Consumer projects can import a sibling host project: install every dependency tree first.
  await finishAll(
    fixtures.map(({ directory }) =>
      runCommand(
        process.execPath,
        [path.join(directory, 'node_modules/typescript/bin/tsc'), '-p', path.join(directory, 'tsconfig.json')],
        {
          cwd: directory,
          encoding: 'utf8',
          timeout: 180000
        }
      )
    ),
    'typecheck'
  );
};
