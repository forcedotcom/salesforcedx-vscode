/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import {
  ArtifactIdentitySchema,
  SObjectArtifactIdentitySchema,
  artifactIdentitiesEqual,
  artifactIdentityKey,
  artifactNamespacesEqual,
  normalizeArtifactIdentity
} from '../../../src/core/artifactIdentity';

describe('artifact identity', () => {
  it.each([
    { kind: 'sobject', namespace: null, name: 'Widget__c' },
    { kind: 'sobject', namespace: 'MyPackage', name: 'Widget__c' },
    { kind: 'metadata-component', metadataType: 'ApexClass', namespace: null, name: 'Example' }
  ] as const)('decodes a canonical $kind identity for $name', identity => {
    expect(Schema.decodeUnknownSync(ArtifactIdentitySchema)(identity)).toEqual(identity);
  });

  it('requires an explicit null namespace for a global identity', () => {
    expect(() =>
      Schema.decodeUnknownSync(SObjectArtifactIdentitySchema)({ kind: 'sobject', name: 'Widget__c' })
    ).toThrow('namespace');
    expect(() =>
      Schema.decodeUnknownSync(SObjectArtifactIdentitySchema)({ kind: 'sobject', namespace: '', name: 'Widget__c' })
    ).toThrow('namespace');
  });

  it('normalizes comparison fields without changing the canonical input', () => {
    const identity = {
      kind: 'metadata-component',
      metadataType: 'ApexClass',
      namespace: 'MyPackage',
      name: 'Outer.Inner'
    } as const;

    expect(normalizeArtifactIdentity(identity)).toEqual({
      kind: 'metadata-component',
      metadataType: 'apexclass',
      namespace: 'mypackage',
      name: 'outer.inner'
    });
    expect(identity).toEqual({
      kind: 'metadata-component',
      metadataType: 'ApexClass',
      namespace: 'MyPackage',
      name: 'Outer.Inner'
    });
  });

  it('matches namespace and name case-insensitively', () => {
    expect(
      artifactIdentitiesEqual(
        { kind: 'sobject', namespace: 'MyPackage', name: 'Widget__c' },
        { kind: 'sobject', namespace: 'MYPACKAGE', name: 'widget__c' }
      )
    ).toBe(true);
    expect(artifactNamespacesEqual('MyPackage', 'mypackage')).toBe(true);
  });

  it('does not conflate namespace with dotted names', () => {
    const namespaced = {
      kind: 'metadata-component',
      metadataType: 'ApexClass',
      namespace: 'MyPackage',
      name: 'Example'
    } as const;
    const dottedName = {
      kind: 'metadata-component',
      metadataType: 'ApexClass',
      namespace: null,
      name: 'MyPackage.Example'
    } as const;

    expect(artifactIdentitiesEqual(namespaced, dottedName)).toBe(false);
    expect(artifactIdentityKey(namespaced)).not.toBe(artifactIdentityKey(dottedName));
  });

  it('distinguishes target kind and metadata type', () => {
    expect(
      artifactIdentitiesEqual(
        { kind: 'metadata-component', metadataType: 'CustomObject', namespace: null, name: 'Widget__c' },
        { kind: 'sobject', namespace: null, name: 'Widget__c' }
      )
    ).toBe(false);
    expect(
      artifactIdentitiesEqual(
        { kind: 'metadata-component', metadataType: 'ApexClass', namespace: null, name: 'Example' },
        { kind: 'metadata-component', metadataType: 'ApexTrigger', namespace: null, name: 'Example' }
      )
    ).toBe(false);
  });
});
