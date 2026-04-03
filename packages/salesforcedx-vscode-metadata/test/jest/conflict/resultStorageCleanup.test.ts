/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as HashSet from 'effect/HashSet';
import { HashableUri } from 'salesforcedx-vscode-services/src/vscode/hashableUri';
import { getStaleUris } from '../../../src/conflict/resultStorageCleanup';

const uri = (path: string) => HashableUri.file(path);

const u1 = uri('/org/deploy-2024-01-01.json');
const u2 = uri('/org/deploy-2024-02-01.json');
const u3 = uri('/org/deploy-2024-03-01.json');

describe('getStaleUris', () => {
  it('returns all uris when byKey is empty', () => {
    const all = HashSet.fromIterable([u1, u2]);
    const stale = getStaleUris({}, all);
    expect(HashSet.has(stale, u1)).toBe(true);
    expect(HashSet.has(stale, u2)).toBe(true);
  });

  it('returns empty set when every uri is a winner', () => {
    const all = HashSet.fromIterable([u1, u2]);
    const byKey = {
      'ApexClass:Foo': [{ sourceUri: u1 }],
      'ApexClass:Bar': [{ sourceUri: u2 }]
    };
    const stale = getStaleUris(byKey, all);
    expect(HashSet.size(stale)).toBe(0);
  });

  it('returns only the uri not referenced by any winning row', () => {
    const all = HashSet.fromIterable([u1, u2]);
    // u2 wins for both keys; u1 is superseded
    const byKey = {
      'ApexClass:Foo': [{ sourceUri: u2 }, { sourceUri: u1 }],
      'ApexClass:Bar': [{ sourceUri: u2 }]
    };
    const stale = getStaleUris(byKey, all);
    expect(HashSet.has(stale, u1)).toBe(true);
    expect(HashSet.has(stale, u2)).toBe(false);
  });

  it('keeps a uri that wins for at least one key even when it loses others', () => {
    const all = HashSet.fromIterable([u1, u2]);
    // u1 wins Foo; u2 wins Bar
    const byKey = {
      'ApexClass:Foo': [{ sourceUri: u1 }, { sourceUri: u2 }],
      'ApexClass:Bar': [{ sourceUri: u2 }, { sourceUri: u1 }]
    };
    const stale = getStaleUris(byKey, all);
    expect(HashSet.size(stale)).toBe(0);
  });

  it('returns stale uri absent from byKey winners among three files', () => {
    const all = HashSet.fromIterable([u1, u2, u3]);
    const byKey = {
      'ApexClass:Foo': [{ sourceUri: u3 }],
      'ApexClass:Bar': [{ sourceUri: u2 }]
    };
    const stale = getStaleUris(byKey, all);
    expect(HashSet.has(stale, u1)).toBe(true);
    expect(HashSet.has(stale, u2)).toBe(false);
    expect(HashSet.has(stale, u3)).toBe(false);
  });
});
