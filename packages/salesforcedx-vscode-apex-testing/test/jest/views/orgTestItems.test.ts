/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ResolvedPackageInfo } from '../../../src/testDiscovery/schemas';
import { LOCAL_NAMESPACE_KEY, UNPACKAGED_PACKAGE_ID, UNPACKAGED_PACKAGE_KEY } from '../../../src/constants';
import {
  getNamespaceDisplayLabel,
  getPackageKeysOrdered,
  getPackageLabelAndId,
  sortNamespaceKeys
} from '../../../src/views/orgTestItems';

const makeClassEntry = (id?: string) => ({
  fullClassName: 'TestClass',
  entries: [{ id, name: 'TestClass', namespacePrefix: '' }] as any
});

describe('sortNamespaceKeys', () => {
  it('places local namespace first when it is the only key', () => {
    const structure = new Map([[LOCAL_NAMESPACE_KEY, new Map()]]);
    expect(sortNamespaceKeys(structure)).toEqual([LOCAL_NAMESPACE_KEY]);
  });

  it('places local namespace first regardless of alphabetical position', () => {
    const structure = new Map([
      ['ZZZ', new Map()],
      ['AAA', new Map()],
      [LOCAL_NAMESPACE_KEY, new Map()],
      ['MMM', new Map()]
    ]);
    const result = sortNamespaceKeys(structure);
    expect(result[0]).toBe(LOCAL_NAMESPACE_KEY);
    expect(result.slice(1)).toEqual(['AAA', 'MMM', 'ZZZ']);
  });

  it('sorts non-local namespaces alphabetically', () => {
    const structure = new Map([
      ['ns_c', new Map()],
      ['ns_a', new Map()],
      ['ns_b', new Map()]
    ]);
    expect(sortNamespaceKeys(structure)).toEqual(['ns_a', 'ns_b', 'ns_c']);
  });

  it('handles a single non-local namespace', () => {
    const structure = new Map([['onlyNs', new Map()]]);
    expect(sortNamespaceKeys(structure)).toEqual(['onlyNs']);
  });
});

describe('getPackageKeysOrdered', () => {
  it('places unpackaged first in local namespace', () => {
    const keys = ['somePkg', UNPACKAGED_PACKAGE_KEY, 'anotherPkg'];
    expect(getPackageKeysOrdered(LOCAL_NAMESPACE_KEY, keys)).toEqual([UNPACKAGED_PACKAGE_KEY, 'somePkg', 'anotherPkg']);
  });

  it('does not reorder when unpackaged is already first in local namespace', () => {
    const keys = [UNPACKAGED_PACKAGE_KEY, 'pkg1', 'pkg2'];
    expect(getPackageKeysOrdered(LOCAL_NAMESPACE_KEY, keys)).toEqual([UNPACKAGED_PACKAGE_KEY, 'pkg1', 'pkg2']);
  });

  it('does not reorder for non-local namespaces', () => {
    const keys = ['somePkg', UNPACKAGED_PACKAGE_KEY, 'anotherPkg'];
    expect(getPackageKeysOrdered('otherNs', keys)).toEqual(keys);
  });

  it('returns keys unchanged when unpackaged is absent from local namespace', () => {
    const keys = ['pkg1', 'pkg2'];
    expect(getPackageKeysOrdered(LOCAL_NAMESPACE_KEY, keys)).toEqual(['pkg1', 'pkg2']);
  });
});

describe('getPackageLabelAndId', () => {
  it('returns localized label and fixed ID for unpackaged metadata', () => {
    const result = getPackageLabelAndId(
      LOCAL_NAMESPACE_KEY,
      UNPACKAGED_PACKAGE_KEY,
      [makeClassEntry()] as any,
      new Map()
    );
    expect(result.packageLabel).toBe('(Unpackaged Metadata)');
    expect(result.packageId).toBe(UNPACKAGED_PACKAGE_ID);
  });

  it('returns 1GP label with namespace name', () => {
    const result = getPackageLabelAndId('myNs', '1gp', [makeClassEntry()] as any, new Map());
    expect(result.packageLabel).toBe('myNs (1GP)');
    expect(result.packageId).toBe('package:myNs:1gp');
  });

  it('returns unlocked package label with suffix', () => {
    const classIdToPackage = new Map<string, ResolvedPackageInfo>([
      ['cls1', { package2Id: '0Ho1', packageName: 'MyPkg', namespacePrefix: null, containerOptions: 'Unlocked' }]
    ]);
    const result = getPackageLabelAndId('local', 'myPkgKey', [makeClassEntry('cls1')] as any, classIdToPackage);
    expect(result.packageLabel).toBe('MyPkg (Unlocked)');
  });

  it('returns managed package label with suffix', () => {
    const classIdToPackage = new Map<string, ResolvedPackageInfo>([
      [
        'cls1',
        { package2Id: '0Ho2', packageName: 'CRM Analytics', namespacePrefix: 'wave', containerOptions: 'Managed' }
      ]
    ]);
    const result = getPackageLabelAndId('wave', 'pkgKey', [makeClassEntry('cls1')] as any, classIdToPackage);
    expect(result.packageLabel).toBe('CRM Analytics (Managed Package)');
  });

  it('falls back to baseName with no suffix when containerOptions is absent', () => {
    const classIdToPackage = new Map<string, ResolvedPackageInfo>([
      ['cls1', { package2Id: '0Ho3', packageName: 'SomePkg', namespacePrefix: null }]
    ]);
    const result = getPackageLabelAndId('ns', 'key', [makeClassEntry('cls1')] as any, classIdToPackage);
    expect(result.packageLabel).toBe('SomePkg');
  });

  it('falls back to pkgKey when class has no ID', () => {
    const result = getPackageLabelAndId('ns', 'fallbackKey', [makeClassEntry(undefined)] as any, new Map());
    expect(result.packageLabel).toBe('fallbackKey');
  });
});

describe('getNamespaceDisplayLabel', () => {
  it('returns localized label for local namespace', () => {
    expect(getNamespaceDisplayLabel(LOCAL_NAMESPACE_KEY)).toBe('(Local Namespace)');
  });

  it('returns the key as-is for non-local namespaces', () => {
    expect(getNamespaceDisplayLabel('myNamespace')).toBe('myNamespace');
    expect(getNamespaceDisplayLabel('wave')).toBe('wave');
  });
});
