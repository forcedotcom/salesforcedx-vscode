/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { prepareVsixExtensions } from '../../../src/fixtures/vsixExtensions';
import { redactText, redactValue } from '../../../src/utils/redaction';

const createPackage = async (
  repoRoot: string,
  directory: string,
  extensionDependencies: string[] = [],
  vsixContents = directory
): Promise<string> => {
  const packageDir = path.join(repoRoot, 'packages', directory);
  await mkdir(packageDir, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(packageDir, 'package.json'),
      JSON.stringify({ name: directory, publisher: 'salesforce', version: '1.0.0', extensionDependencies })
    ),
    writeFile(path.join(packageDir, `${directory}-1.0.0.vsix`), vsixContents)
  ]);
  return packageDir;
};

const createFakeVsCode = async (root: string): Promise<{ executable: string; installsLog: string }> => {
  const executable =
    process.platform === 'darwin'
      ? path.join(root, 'Visual Studio Code.app', 'Contents', 'MacOS', 'Electron')
      : process.platform === 'win32'
        ? path.join(root, 'Code.exe')
        : path.join(root, 'code');
  const cli =
    process.platform === 'darwin'
      ? path.join(root, 'Visual Studio Code.app', 'Contents', 'Resources', 'app', 'bin', 'code')
      : process.platform === 'win32'
        ? path.join(root, 'bin', 'code.cmd')
        : path.join(root, 'bin', 'code');
  const installsLog = path.join(root, 'installs.log');
  const scriptPath = path.join(root, 'fakeCodeCli.cjs');
  const script = `
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const extensionsDir = args[args.indexOf('--extensions-dir') + 1];
const manifestPath = path.join(extensionsDir, 'extensions.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
if (args.includes('--list-extensions')) {
  manifest.map(extension => console.log(extension.identifier.id + '@' + extension.version));
  process.exit(0);
}
const target = args[args.indexOf('--install-extension') + 1];
fs.mkdirSync(extensionsDir, { recursive: true });
fs.appendFileSync(${JSON.stringify(installsLog)}, target + '\\n');
if (target.endsWith('.vsix')) {
  const extensionPackage = JSON.parse(fs.readFileSync(path.join(path.dirname(target), 'package.json'), 'utf8'));
  const id = extensionPackage.publisher + '.' + extensionPackage.name;
  const relativeLocation = id + '-' + extensionPackage.version;
  fs.mkdirSync(path.join(extensionsDir, relativeLocation));
  fs.copyFileSync(path.join(path.dirname(target), 'package.json'), path.join(extensionsDir, relativeLocation, 'package.json'));
  manifest.push({ identifier: { id }, version: extensionPackage.version, relativeLocation, metadata: { source: 'vsix' } });
} else {
  manifest.push({ identifier: { id: target }, version: '9.0.0', metadata: { source: 'gallery' } });
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest));
`;
  const launcher =
    process.platform === 'win32'
      ? `@node ${JSON.stringify(scriptPath)} %*\r\n`
      : `#!/bin/sh\nexec node ${JSON.stringify(scriptPath)} "$@"\n`;
  await Promise.all([
    mkdir(path.dirname(executable), { recursive: true }),
    mkdir(path.dirname(cli), { recursive: true }),
    writeFile(scriptPath, script)
  ]);
  await Promise.all([writeFile(executable, ''), writeFile(cli, launcher)]);
  if (process.platform !== 'win32') await chmod(cli, 0o755);
  return { executable, installsLog };
};

const readInstalls = async (installsLog: string): Promise<string[]> =>
  (await readFile(installsLog, 'utf8')).trim().split(/\r?\n/u);

test.describe('prepareVsixExtensions', () => {
  test('prepares root VSIXs in dependency order and returns exact provenance', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'prepare-vsix-'));
    try {
      await Promise.all([
        createPackage(repoRoot, 'dependent', ['salesforce.dependency']),
        createPackage(repoRoot, 'dependency')
      ]);
      const { executable, installsLog } = await createFakeVsCode(repoRoot);

      const result = await prepareVsixExtensions({
        repoRoot,
        packageDirs: ['dependent', 'dependency', 'dependent'],
        vscodeExecutable: executable
      });

      expect(path.dirname(result.extensionsDir)).toBe(path.join(repoRoot, '.vscode-test'));
      expect(result.extensions.map(extension => extension.id)).toEqual([
        'salesforce.dependency',
        'salesforce.dependent'
      ]);
      expect(result.extensions.map(extension => path.basename(extension.vsixPath))).toEqual([
        'dependency-1.0.0.vsix',
        'dependent-1.0.0.vsix'
      ]);
      expect(result.extensions.map(extension => extension.sha256)).toEqual([
        'f26350dafe3f19aabfd69ac463fb5daf76015c9a2763e76e2ad32fc0fcfedf31',
        '75846e529667722d646a18ae052b393391cfe1ffe98c45f2952a63723938c003'
      ]);
      expect(result.extensions.map(extension => path.dirname(extension.directory))).toEqual([
        result.extensionsDir,
        result.extensionsDir
      ]);
      expect((await readInstalls(installsLog)).map(install => path.basename(install))).toEqual([
        'dependency-1.0.0.vsix',
        'dependent-1.0.0.vsix'
      ]);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  test('requires the VSIX matching the package version and ignores stale versions', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'prepare-vsix-input-'));
    try {
      const packageDir = await createPackage(repoRoot, 'extension');
      await rm(path.join(packageDir, 'extension-1.0.0.vsix'));
      const { executable } = await createFakeVsCode(repoRoot);
      await expect(
        prepareVsixExtensions({ repoRoot, packageDirs: ['extension'], vscodeExecutable: executable })
      ).rejects.toThrow('Expected packages/extension/extension-1.0.0.vsix, found []');

      await writeFile(path.join(packageDir, 'extension-0.9.0.vsix'), 'stale');
      await expect(
        prepareVsixExtensions({ repoRoot, packageDirs: ['extension'], vscodeExecutable: executable })
      ).rejects.toThrow('Expected packages/extension/extension-1.0.0.vsix, found [extension-0.9.0.vsix]');

      await writeFile(path.join(packageDir, 'extension-1.0.0.vsix'), 'current');
      const result = await prepareVsixExtensions({
        repoRoot,
        packageDirs: ['extension'],
        vscodeExecutable: executable
      });
      expect(path.basename(result.extensions[0].vsixPath)).toBe('extension-1.0.0.vsix');
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  test('isolates caches by VSIX content and marketplace inputs', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'prepare-vsix-cache-key-'));
    try {
      const packageDir = await createPackage(repoRoot, 'extension');
      const { executable } = await createFakeVsCode(repoRoot);
      const first = await prepareVsixExtensions({ repoRoot, packageDirs: ['extension'], vscodeExecutable: executable });
      await writeFile(path.join(packageDir, 'extension-1.0.0.vsix'), 'changed');
      const changed = await prepareVsixExtensions({
        repoRoot,
        packageDirs: ['extension'],
        vscodeExecutable: executable
      });
      const marketplace = await prepareVsixExtensions({
        repoRoot,
        packageDirs: ['extension'],
        vscodeExecutable: executable,
        marketplaceExtensions: ['MARKETPLACE.EXTRA']
      });

      expect(new Set([first.extensionsDir, changed.extensionsDir, marketplace.extensionsDir]).size).toBe(3);
      expect(changed.extensions[0].sha256).not.toBe(first.extensions[0].sha256);
      const installed = JSON.parse(await readFile(path.join(marketplace.extensionsDir, 'extensions.json'), 'utf8')) as {
        identifier: { id: string };
      }[];
      expect(installed.map(extension => extension.identifier.id)).toContain('marketplace.extra');
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  test('recovers invalid caches and atomically shares one concurrent installation', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'prepare-vsix-recovery-'));
    try {
      await createPackage(repoRoot, 'extension');
      const { executable, installsLog } = await createFakeVsCode(repoRoot);
      const first = await prepareVsixExtensions({ repoRoot, packageDirs: ['extension'], vscodeExecutable: executable });
      await writeFile(path.join(first.extensionsDir, 'extensions.json'), '[]');
      const recovered = await prepareVsixExtensions({
        repoRoot,
        packageDirs: ['extension'],
        vscodeExecutable: executable
      });
      expect(recovered.extensions).toHaveLength(1);
      expect(await readInstalls(installsLog)).toHaveLength(2);

      await rm(recovered.extensionsDir, { recursive: true, force: true });
      await writeFile(installsLog, '');
      const concurrent = await Promise.all(
        [1, 2, 3].map(() =>
          prepareVsixExtensions({ repoRoot, packageDirs: ['extension'], vscodeExecutable: executable })
        )
      );
      expect(new Set(concurrent.map(result => result.extensionsDir)).size).toBe(1);
      expect(await readInstalls(installsLog)).toHaveLength(1);
      expect((await readdir(path.join(repoRoot, '.vscode-test'))).filter(entry => entry.includes('.tmp.'))).toEqual([]);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  test('recovers a cache lock abandoned by a dead process', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'prepare-vsix-abandoned-lock-'));
    try {
      await createPackage(repoRoot, 'extension');
      const { executable } = await createFakeVsCode(repoRoot);
      const first = await prepareVsixExtensions({ repoRoot, packageDirs: ['extension'], vscodeExecutable: executable });
      const lockDir = `${first.extensionsDir}.lock`;
      await mkdir(lockDir);
      await writeFile(
        path.join(lockDir, 'owner.json'),
        JSON.stringify({ pid: 2_147_483_647, createdAt: Date.now(), token: 'abandoned' })
      );

      const recovered = await prepareVsixExtensions({
        repoRoot,
        packageDirs: ['extension'],
        vscodeExecutable: executable
      });

      expect(recovered.extensionsDir).toBe(first.extensionsDir);
      await expect(readFile(path.join(lockDir, 'owner.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });
});

test('scrubs diagnostic text and nested artifact values', () => {
  const redacted = redactValue({
    authorization: 'Bearer direct-secret',
    console: 'request token=console-secret password: password-secret',
    nested: ['https://user:url-secret@example.com', 'eyJhbGciOiJIUzI1NiJ9.payload.signature']
  });
  const output = JSON.stringify(redacted);
  expect(output).not.toMatch(/direct-secret|console-secret|password-secret|url-secret|payload/);
  expect(redactText('sid=session-secret')).toBe('sid=[REDACTED]');
  expect(redactText('00D000000000000!AQEAQKa-b+c=d_e.f')).toBe('[REDACTED]');
  expect(redactText('version 67.9.3 at /tmp/salesforcedx-vscode-core-67.9.3.vsix')).toBe(
    'version 67.9.3 at /tmp/salesforcedx-vscode-core-67.9.3.vsix'
  );
});
