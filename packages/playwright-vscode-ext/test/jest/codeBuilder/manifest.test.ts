/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeManifest, readManifest, writeManifest } from '../../../src/codeBuilder/manifest';

describe('manifest', () => {
  const dirs: string[] = [];
  const tmp = (): string => {
    const d = mkdtempSync(join(tmpdir(), 'cb-manifest-test-'));
    dirs.push(d);
    return d;
  };
  afterAll(() => dirs.forEach(d => rmSync(d, { recursive: true, force: true })));

  it('makeManifest maps swap results into schema-shaped entries', () => {
    const m = makeManifest([
      { id: 'salesforce.core', version: '67.4.0', pkgJsonDigest: 'a', bundleDigest: 'b' },
      { id: 'salesforce.decl', version: '67.4.0', pkgJsonDigest: 'c', bundleDigest: null }
    ]);
    expect(m.schemaVersion).toBe(1);
    expect(m.entries).toHaveLength(2);
    expect(m.entries[1].bundleDigest).toBeNull();
  });

  it('round-trips through disk (write → read) preserving null bundleDigest', () => {
    const m = makeManifest([
      { id: 'salesforce.core', version: '67.4.0', pkgJsonDigest: 'aa', bundleDigest: 'bb' },
      { id: 'salesforce.decl', version: '67.4.0', pkgJsonDigest: 'cc', bundleDigest: null }
    ]);
    const path = join(tmp(), 'manifest.json');
    writeManifest(path, m);
    expect(readManifest(path)).toEqual(m);
  });

  it('throws on a missing manifest file', () => {
    expect(() => readManifest(join(tmp(), 'nope.json'))).toThrow(/manifest not found/);
  });

  it('throws (validation) on a malformed manifest', () => {
    const path = join(tmp(), 'bad.json');
    writeFileSync(path, JSON.stringify({ schemaVersion: 2, entries: 'not-an-array' }));
    expect(() => readManifest(path)).toThrow(/invalid manifest/);
  });
});
