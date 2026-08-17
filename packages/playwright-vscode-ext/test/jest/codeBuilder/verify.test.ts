/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeExtensionDigest } from '../../../src/codeBuilder/digest';
import { makeManifest } from '../../../src/codeBuilder/manifest';
import type { CommandRunner } from '../../../src/codeBuilder/runner';
import { OVERRIDES_DIR, verifyExtensions } from '../../../src/codeBuilder/verify';

/** Make a real extension tree on disk (the "installed" bytes the fake `docker cp` will hand back). */
const makeExtensionTree = (pkg: Record<string, unknown>, bundle?: { path: string; content: string }): string => {
  const dir = mkdtempSync(join(tmpdir(), 'cb-verify-src-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
  if (bundle) {
    writeFileSync(join(dir, bundle.path), bundle.content);
  }
  return dir;
};

/*
 * Fake runner: answers `ls -d …` with the configured override dirs for each id, and on `docker cp
 * <c>:<src>/. <dest>` copies the mapped source tree into <dest> so computeExtensionDigest has real
 * bytes. Records every argv for assertions.
 */
const makeFakeRunner = (opts: {
  dirsById: Record<string, string[]>; // id → container override dir paths the ls returns
  treeByContainerDir: Record<string, string>; // container dir path → host source tree to copy out
}): { runner: CommandRunner; calls: string[][] } => {
  const calls: string[][] = [];
  const runner: CommandRunner = (file, args) => {
    calls.push([file, ...args]);
    const script = args.at(-1);
    if (args[0] === 'exec' && typeof script === 'string' && script.includes('ls -d')) {
      const id = Object.keys(opts.dirsById).find(k => script.includes(`${OVERRIDES_DIR}/${k}-[0-9]`));
      return id ? opts.dirsById[id].join('\n') : '';
    }
    if (args[0] === 'cp') {
      const srcSpec = args[1]; // "<container>:<dir>/."
      const dest = args[2];
      const containerDir = srcSpec.slice(srcSpec.indexOf(':') + 1).replace(/\/\.$/, '');
      const srcTree = opts.treeByContainerDir[containerDir];
      mkdirSync(dest, { recursive: true });
      cpSync(srcTree, dest, { recursive: true });
      return '';
    }
    return '';
  };
  return { runner, calls };
};

describe('verifyExtensions', () => {
  const cleanup: string[] = [];
  const track = (d: string): string => {
    cleanup.push(d);
    return d;
  };
  afterAll(() => cleanup.forEach(d => rmSync(d, { recursive: true, force: true })));

  const CONTAINER = 'cb-test';
  const CORE_ID = 'salesforce.salesforcedx-vscode-core';
  const CORE_DIR = `${OVERRIDES_DIR}/${CORE_ID}-67.4.0`;

  it('passes when the installed bytes match the manifest digest', () => {
    const tree = track(
      makeExtensionTree(
        { name: 'salesforcedx-vscode-core', version: '67.4.0', main: 'm.js' },
        { path: 'm.js', content: 'v1' }
      )
    );
    const digest = computeExtensionDigest(tree);
    const manifest = makeManifest([{ id: CORE_ID, version: '67.4.0', ...digest }]);
    const { runner } = makeFakeRunner({
      dirsById: { [CORE_ID]: [CORE_DIR] },
      treeByContainerDir: { [CORE_DIR]: tree }
    });

    const result = verifyExtensions(CONTAINER, manifest, { runner });
    expect(result.ok).toBe(true);
    expect(result.entries[0]).toMatchObject({ id: CORE_ID, ok: true });
  });

  it('issues the correct docker cp argv (seam correctness)', () => {
    const tree = track(makeExtensionTree({ name: 'c', version: '67.4.0' }));
    const manifest = makeManifest([{ id: CORE_ID, version: '67.4.0', ...computeExtensionDigest(tree) }]);
    const { runner, calls } = makeFakeRunner({
      dirsById: { [CORE_ID]: [CORE_DIR] },
      treeByContainerDir: { [CORE_DIR]: tree }
    });

    verifyExtensions(CONTAINER, manifest, { runner });
    const cp = calls.find(c => c[1] === 'cp');
    expect(cp?.slice(0, 3)).toEqual(['docker', 'cp', `${CONTAINER}:${CORE_DIR}/.`]);
  });

  it('fails loud when a stale dir yields a digest mismatch (the false-green)', () => {
    const installed = track(
      makeExtensionTree({ name: 'c', version: '67.4.0', main: 'm.js' }, { path: 'm.js', content: 'STALE' })
    );
    const intended = track(
      makeExtensionTree({ name: 'c', version: '67.4.0', main: 'm.js' }, { path: 'm.js', content: 'FRESH' })
    );
    // Manifest carries the intended (fresh) digest; the container hands back stale bytes.
    const manifest = makeManifest([{ id: CORE_ID, version: '67.4.0', ...computeExtensionDigest(intended) }]);
    const { runner } = makeFakeRunner({
      dirsById: { [CORE_ID]: [CORE_DIR] },
      treeByContainerDir: { [CORE_DIR]: installed }
    });

    const result = verifyExtensions(CONTAINER, manifest, { runner });
    expect(result.ok).toBe(false);
    expect(result.entries[0].reason).toMatch(/digest mismatch/);
  });

  it('fails when there is no override dir (swap did not install)', () => {
    const manifest = makeManifest([{ id: CORE_ID, version: '67.4.0', pkgJsonDigest: 'x', bundleDigest: null }]);
    const { runner } = makeFakeRunner({ dirsById: { [CORE_ID]: [] }, treeByContainerDir: {} });

    const result = verifyExtensions(CONTAINER, manifest, { runner });
    expect(result.ok).toBe(false);
    expect(result.entries[0].reason).toMatch(/expected exactly 1 override dir, found 0/);
  });

  it('fails when a leftover second dir is present (duplicate)', () => {
    const manifest = makeManifest([{ id: CORE_ID, version: '67.4.0', pkgJsonDigest: 'x', bundleDigest: null }]);
    const { runner } = makeFakeRunner({
      dirsById: { [CORE_ID]: [CORE_DIR, `${OVERRIDES_DIR}/${CORE_ID}-67.0.0`] },
      treeByContainerDir: {}
    });

    const result = verifyExtensions(CONTAINER, manifest, { runner });
    expect(result.ok).toBe(false);
    expect(result.entries[0].reason).toMatch(/found 2/);
  });
});
