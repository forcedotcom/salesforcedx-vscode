/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  computeExtensionDigest,
  resolveEntrypoint,
  resolveExtensionRoot,
  UnresolvableEntrypointError
} from '../../../src/codeBuilder/digest';

/** Build an extension dir on disk. `layout: 'nested'` puts files under extension/ (raw .vsix shape). */
const makeExtension = (opts: {
  pkg: Record<string, unknown>;
  bundle?: { path: string; content: string };
  layout?: 'flat' | 'nested';
}): string => {
  const dir = mkdtempSync(join(tmpdir(), 'cb-digest-test-'));
  const root = opts.layout === 'nested' ? join(dir, 'extension') : dir;
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify(opts.pkg));
  if (opts.bundle) {
    const bundlePath = join(root, opts.bundle.path);
    mkdirSync(join(bundlePath, '..'), { recursive: true });
    writeFileSync(bundlePath, opts.bundle.content);
  }
  return dir;
};

describe('digest', () => {
  const dirs: string[] = [];
  const track = (d: string): string => {
    dirs.push(d);
    return d;
  };
  afterAll(() => dirs.forEach(d => rmSync(d, { recursive: true, force: true })));

  describe('resolveExtensionRoot', () => {
    it('returns the dir itself when package.json is at the root (installed override shape)', () => {
      const d = track(makeExtension({ pkg: { name: 'x', version: '1.0.0' } }));
      expect(resolveExtensionRoot(d)).toBe(d);
    });

    it('descends into extension/ when package.json is nested (raw .vsix shape)', () => {
      const d = track(makeExtension({ pkg: { name: 'x', version: '1.0.0' }, layout: 'nested' }));
      expect(resolveExtensionRoot(d)).toBe(join(d, 'extension'));
    });

    it('throws when no package.json is found', () => {
      const d = track(mkdtempSync(join(tmpdir(), 'cb-empty-')));
      expect(() => resolveExtensionRoot(d)).toThrow(/no package.json/);
    });
  });

  describe('resolveEntrypoint strictness', () => {
    it('returns null when main is absent (declarative extension)', () => {
      const d = track(makeExtension({ pkg: { name: 'x', version: '1.0.0' } }));
      expect(resolveEntrypoint(d)).toBeNull();
    });

    it('returns null when main is empty string', () => {
      const d = track(makeExtension({ pkg: { name: 'x', version: '1.0.0', main: '' } }));
      expect(resolveEntrypoint(d)).toBeNull();
    });

    it('resolves main to an absolute file path when it exists', () => {
      const d = track(
        makeExtension({
          pkg: { name: 'x', version: '1.0.0', main: './dist/index.js' },
          bundle: { path: 'dist/index.js', content: 'code' }
        })
      );
      expect(resolveEntrypoint(d)).toBe(join(d, 'dist/index.js'));
    });

    it('throws UnresolvableEntrypointError when main is declared but missing (broken build/swap)', () => {
      const d = track(makeExtension({ pkg: { name: 'x', version: '1.0.0', main: './dist/index.js' } }));
      expect(() => resolveEntrypoint(d)).toThrow(UnresolvableEntrypointError);
    });

    it('ignores browser and keys off main only (CB runs the desktop build)', () => {
      const d = track(
        makeExtension({
          pkg: { name: 'x', version: '1.0.0', main: './dist/node.js', browser: './dist/web.js' },
          bundle: { path: 'dist/node.js', content: 'node-code' }
        })
      );
      expect(resolveEntrypoint(d)).toBe(join(d, 'dist/node.js'));
    });

    it('throws when main uses `..` to escape the extension root', () => {
      // A traversing main would hash bytes outside the extension and could reconcile differently
      // across the swap/verify temp dirs — reject it rather than silently hash the wrong file.
      const d = track(makeExtension({ pkg: { name: 'x', version: '1.0.0', main: '../../../etc/hosts' } }));
      expect(() => resolveEntrypoint(d)).toThrow(UnresolvableEntrypointError);
    });

    it('throws when main is an absolute path outside the root', () => {
      const d = track(makeExtension({ pkg: { name: 'x', version: '1.0.0', main: '/etc/hosts' } }));
      expect(() => resolveEntrypoint(d)).toThrow(UnresolvableEntrypointError);
    });
  });

  describe('computeExtensionDigest', () => {
    it('produces both digests when a bundle exists', () => {
      const d = track(
        makeExtension({
          pkg: { name: 'x', version: '1.0.0', main: 'main.js' },
          bundle: { path: 'main.js', content: 'abc' }
        })
      );
      const digest = computeExtensionDigest(d);
      expect(digest.pkgJsonDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(digest.bundleDigest).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces a null bundleDigest for a declarative extension', () => {
      const d = track(makeExtension({ pkg: { name: 'x', version: '1.0.0' } }));
      expect(computeExtensionDigest(d).bundleDigest).toBeNull();
    });

    it('changes bundleDigest when only the bundle bytes change (the false-green catch)', () => {
      const a = track(
        makeExtension({ pkg: { name: 'x', version: '1.0.0', main: 'm.js' }, bundle: { path: 'm.js', content: 'v1' } })
      );
      const b = track(
        makeExtension({ pkg: { name: 'x', version: '1.0.0', main: 'm.js' }, bundle: { path: 'm.js', content: 'v2' } })
      );
      const da = computeExtensionDigest(a);
      const db = computeExtensionDigest(b);
      expect(da.pkgJsonDigest).toBe(db.pkgJsonDigest); // identical package.json
      expect(da.bundleDigest).not.toBe(db.bundleDigest); // different bundle → caught
    });

    it('is stable across the nested (.vsix) and flat (installed) layouts', () => {
      const flat = track(
        makeExtension({ pkg: { name: 'x', version: '1.0.0', main: 'm.js' }, bundle: { path: 'm.js', content: 'same' } })
      );
      const nested = track(
        makeExtension({
          pkg: { name: 'x', version: '1.0.0', main: 'm.js' },
          bundle: { path: 'm.js', content: 'same' },
          layout: 'nested'
        })
      );
      expect(computeExtensionDigest(flat)).toEqual(computeExtensionDigest(nested));
    });
  });
});
