/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CommandRunner } from '../../../src/codeBuilder/runner';
import { swap, type ExtractZip } from '../../../src/codeBuilder/swap';
import { OVERRIDES_DIR, RUNTIME_EXT_DIR, verifyExtensions } from '../../../src/codeBuilder/verify';

const PREFIX = 'salesforce';

/** Build a fake .vsix source tree on disk: an `extension/` dir (raw-vsix shape) with package.json + bundle. */
const makeVsixTree = (name: string, version: string, bundle?: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'cb-swap-vsix-'));
  const ext = join(dir, 'extension');
  mkdirSync(ext, { recursive: true });
  const pkg: Record<string, unknown> = { name, version, publisher: PREFIX };
  if (bundle !== undefined) {
    pkg.main = 'dist/main.js';
    mkdirSync(join(ext, 'dist'), { recursive: true });
    writeFileSync(join(ext, 'dist/main.js'), bundle);
  }
  writeFileSync(join(ext, 'package.json'), JSON.stringify(pkg));
  return dir; // this dir stands in for "the .vsix file" the extractor is handed
};

/*
 * Fake extractor: instead of unzipping, copy the pre-built source tree (which already has the
 * `extension/` layout) into destDir. So `${sourceTree}` plays the role of the .vsix path.
 */
const fakeExtract: ExtractZip = (sourceTree, destDir) => {
  mkdirSync(destDir, { recursive: true });
  cpSync(sourceTree, destDir, { recursive: true });
};

/** Records every argv; returns '' (swap ignores stdout). */
const makeRecordingRunner = (): { runner: CommandRunner; calls: string[][] } => {
  const calls: string[][] = [];
  const runner: CommandRunner = (file, args) => {
    calls.push([file, ...args]);
    return '';
  };
  return { runner, calls };
};

describe('swap', () => {
  const cleanup: string[] = [];
  const track = (d: string): string => {
    cleanup.push(d);
    return d;
  };
  afterAll(() => cleanup.forEach(d => rmSync(d, { recursive: true, force: true })));
  const CONTAINER = 'cb-test';

  it('wipes BOTH the override dir and runtime symlink by publisher glob, first', () => {
    const vsix = track(makeVsixTree('salesforcedx-vscode-core', '67.4.0', 'code'));
    const { runner, calls } = makeRecordingRunner();

    swap(CONTAINER, [vsix], { publisherPrefix: PREFIX, runner, extract: fakeExtract });

    const wipe = calls[0]; // must be the very first command
    expect(wipe.slice(0, 4)).toEqual(['docker', 'exec', CONTAINER, 'bash']);
    const script = wipe.at(-1) as string;
    expect(script).toContain(`rm -rf ${OVERRIDES_DIR}/${PREFIX}.*`);
    expect(script).toContain(`${RUNTIME_EXT_DIR}/${PREFIX}.*`);
  });

  it("docker cp's the extracted tree contents into a fresh <prefix>.<name>-<version> dir", () => {
    const vsix = track(makeVsixTree('salesforcedx-vscode-core', '67.4.0', 'code'));
    const { runner, calls } = makeRecordingRunner();

    swap(CONTAINER, [vsix], { publisherPrefix: PREFIX, runner, extract: fakeExtract });

    const dest = `${OVERRIDES_DIR}/salesforce.salesforcedx-vscode-core-67.4.0`;
    const cp = calls.find(c => c[1] === 'cp');
    expect(cp?.[2]).toMatch(/\/\.$/); // copies contents (src/.)
    expect(cp?.[3]).toBe(`${CONTAINER}:${dest}`);
    // The dest dir is made fresh before the copy.
    const mk = calls.find(c => (c.at(-1) as string)?.includes(`mkdir -p ${dest}`));
    expect(mk).toBeDefined();
    expect(mk?.at(-1) as string).toContain(`rm -rf ${dest}`);
  });

  it('emits a Manifest whose digests match the installed bytes (swap→verify reconciliation)', () => {
    const vsixCore = track(makeVsixTree('salesforcedx-vscode-core', '67.4.0', 'core-code'));
    const vsixDecl = track(makeVsixTree('salesforcedx-vscode-themes', '67.4.0')); // declarative (no main)

    // Simulate the container holding the installed bytes: eagerly copy each cp'd tree to a durable
    // dir at cp-time (swap deletes its own extraction temp dir on return, just as the real docker cp
    // has already moved the bytes into the container by then).
    const store = track(mkdtempSync(join(tmpdir(), 'cb-installed-')));
    const installedTreeById: Record<string, string> = {};
    const runner: CommandRunner = (file, args) => {
      if (args[0] === 'cp') {
        const src = args[1].replace(/\/\.$/, ''); // host extract root
        const dest = args[2].slice(args[2].indexOf(':') + 1); // <OVERRIDES_DIR>/<id>-<ver>
        const held = join(store, dest.replaceAll('/', '_'));
        mkdirSync(held, { recursive: true });
        cpSync(src, held, { recursive: true });
        installedTreeById[dest] = held;
      }
      return '';
    };

    const manifest = swap(CONTAINER, [vsixCore, vsixDecl], { publisherPrefix: PREFIX, runner, extract: fakeExtract });

    expect(manifest.entries).toHaveLength(2);
    const core = manifest.entries.find(e => e.id === 'salesforce.salesforcedx-vscode-core');
    expect(core).toMatchObject({ version: '67.4.0' });
    expect(core?.bundleDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.entries.find(e => e.id === 'salesforce.salesforcedx-vscode-themes')?.bundleDigest).toBeNull();

    // Now VERIFY against the very manifest swap emitted, with a runner that returns the installed dirs
    // and hands back the exact trees swap copied. It must pass — proving the two sides reconcile.
    const verifyRunner: CommandRunner = (file, args) => {
      const script = args.at(-1);
      if (args[0] === 'exec' && typeof script === 'string' && script.includes('ls -d')) {
        const m = script.match(/ls -d (\S+)-\[0-9\]\*/);
        const prefix = m?.[1] ?? '';
        // Runtime ls: simulate a successful start.sh relink — return the installed override dirs'
        // basenames rebased under RUNTIME_EXT_DIR.
        if (prefix.startsWith(RUNTIME_EXT_DIR)) {
          const id = prefix.slice(RUNTIME_EXT_DIR.length + 1);
          return Object.keys(installedTreeById)
            .filter(d => d.startsWith(`${OVERRIDES_DIR}/${id}-`))
            .map(d => `${RUNTIME_EXT_DIR}/${d.slice(d.lastIndexOf('/') + 1)}`)
            .join('\n');
        }
        return Object.keys(installedTreeById)
          .filter(d => d.startsWith(`${prefix}-`))
          .join('\n');
      }
      if (args[0] === 'cp') {
        const containerDir = args[1].slice(args[1].indexOf(':') + 1).replace(/\/\.$/, '');
        mkdirSync(args[2], { recursive: true });
        cpSync(installedTreeById[containerDir], args[2], { recursive: true });
        return '';
      }
      return '';
    };
    const result = verifyExtensions(CONTAINER, manifest, { runner: verifyRunner });
    expect(result.ok).toBe(true);
  });

  it('rejects an unsafe publisher prefix before touching the container', () => {
    const { runner, calls } = makeRecordingRunner();
    expect(() => swap(CONTAINER, [], { publisherPrefix: 'sf; rm -rf /', runner, extract: fakeExtract })).toThrow(
      /unsafe publisher prefix/
    );
    expect(calls).toHaveLength(0);
  });

  it('rejects a dot-only publisher prefix (would let the wipe glob reach the parent dir)', () => {
    const { runner } = makeRecordingRunner();
    expect(() => swap(CONTAINER, [], { publisherPrefix: '..', runner, extract: fakeExtract })).toThrow(
      /unsafe publisher prefix/
    );
    expect(() => swap(CONTAINER, [], { publisherPrefix: '.', runner, extract: fakeExtract })).toThrow(
      /unsafe publisher prefix/
    );
  });

  it('rejects a package.json name/version with shell metacharacters (no injection into bash -c)', () => {
    const evil = track(makeVsixTree('core"; rm -rf /home #', '67.4.0', 'x'));
    const { runner } = makeRecordingRunner();
    expect(() => swap(CONTAINER, [evil], { publisherPrefix: PREFIX, runner, extract: fakeExtract })).toThrow(
      /unsafe package.json name/
    );

    const evilVersion = track(makeVsixTree('salesforcedx-vscode-core', '0.0.0; rm -rf /', 'x'));
    expect(() => swap(CONTAINER, [evilVersion], { publisherPrefix: PREFIX, runner, extract: fakeExtract })).toThrow(
      /unsafe package.json version/
    );
  });

  it('fails loud when the extension package.json has no name/version (not a silent "undefined" dir)', () => {
    const dir = track(mkdtempSync(join(tmpdir(), 'cb-swap-nover-')));
    mkdirSync(join(dir, 'extension'), { recursive: true });
    writeFileSync(join(dir, 'extension/package.json'), JSON.stringify({ name: 'salesforcedx-vscode-core' })); // no version
    const { runner } = makeRecordingRunner();
    expect(() => swap(CONTAINER, [dir], { publisherPrefix: PREFIX, runner, extract: fakeExtract })).toThrow(
      /missing or non-string package.json version/
    );
  });

  it('fails fast on an empty vsixPaths list — no destructive wipe with nothing to install', () => {
    const { runner, calls } = makeRecordingRunner();
    expect(() => swap(CONTAINER, [], { publisherPrefix: PREFIX, runner, extract: fakeExtract })).toThrow(
      /at least one vsixPath/
    );
    expect(calls).toHaveLength(0); // the wipe never ran
  });

  it('fails loud naming the source vsixPath when its package.json is malformed JSON', () => {
    const dir = track(mkdtempSync(join(tmpdir(), 'cb-swap-badjson-')));
    mkdirSync(join(dir, 'extension'), { recursive: true });
    writeFileSync(join(dir, 'extension/package.json'), '{ not valid json');
    const { runner } = makeRecordingRunner();
    expect(() => swap(CONTAINER, [dir], { publisherPrefix: PREFIX, runner, extract: fakeExtract })).toThrow(
      new RegExp(`invalid package.json in ${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
    );
  });

  it('docker cp source ends in /. (loads a flat override dir, not a nested extension/)', () => {
    const vsix = track(makeVsixTree('salesforcedx-vscode-core', '67.4.0', 'x'));
    const { runner, calls } = makeRecordingRunner();
    swap(CONTAINER, [vsix], { publisherPrefix: PREFIX, runner, extract: fakeExtract });
    const cp = calls.find(c => c[1] === 'cp')!;
    // The trailing /. is load-bearing: it copies the extension CONTENTS flat, so package.json lands
    // at the override dir root (what the image scans + what verify recomputes against).
    expect(cp[2].endsWith('/.')).toBe(true);
  });

  it('installs an explicit list as-is (no dir scan, no dedup)', () => {
    const a = track(makeVsixTree('salesforcedx-vscode-core', '67.4.0', 'a'));
    const b = track(makeVsixTree('salesforcedx-vscode-apex', '67.4.0', 'b'));
    const { runner, calls } = makeRecordingRunner();

    const manifest = swap(CONTAINER, [a, b], { publisherPrefix: PREFIX, runner, extract: fakeExtract });

    expect(manifest.entries.map(e => e.id).toSorted()).toEqual([
      'salesforce.salesforcedx-vscode-apex',
      'salesforce.salesforcedx-vscode-core'
    ]);
    expect(calls.filter(c => c[1] === 'cp')).toHaveLength(2);
  });
});
