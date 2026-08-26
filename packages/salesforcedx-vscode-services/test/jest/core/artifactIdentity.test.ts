/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import {
  ApexTypeArtifactIdentitySchema,
  ArtifactIdentitySchema,
  artifactIdentitiesEqual,
  artifactIdentityKey,
  artifactNamespacesEqual,
  normalizeArtifactIdentity
} from '../../../src/core/artifactIdentity';

describe('artifact identity', () => {
  it.each([
    { kind: 'apex-type', namespace: null, name: 'GlobalType' },
    { kind: 'apex-type', namespace: 'System', name: 'String' },
    { kind: 'apex-type', namespace: 'MyPackage', name: 'Outer.Inner' },
    { kind: 'sobject', namespace: null, name: 'Widget__c' },
    { kind: 'metadata-component', metadataType: 'ApexClass', namespace: null, name: 'Example' }
  ] as const)('decodes a canonical $kind identity for $name', identity => {
    expect(Schema.decodeUnknownSync(ArtifactIdentitySchema)(identity)).toEqual(identity);
  });

  it('requires an explicit null namespace for a global identity', () => {
    expect(() =>
      Schema.decodeUnknownSync(ApexTypeArtifactIdentitySchema)({ kind: 'apex-type', name: 'String' })
    ).toThrow('namespace');
    expect(() =>
      Schema.decodeUnknownSync(ApexTypeArtifactIdentitySchema)({ kind: 'apex-type', namespace: '', name: 'String' })
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
        { kind: 'apex-type', namespace: 'System', name: 'String' },
        { kind: 'apex-type', namespace: 'SYSTEM', name: 'string' }
      )
    ).toBe(true);
    expect(artifactNamespacesEqual('MyPackage', 'mypackage')).toBe(true);
  });

  it('does not conflate namespace with inner-type qualification', () => {
    const namespacedInner = { kind: 'apex-type', namespace: 'MyPackage', name: 'Outer.Inner' } as const;
    const dottedName = { kind: 'apex-type', namespace: null, name: 'MyPackage.Outer.Inner' } as const;

    expect(artifactIdentitiesEqual(namespacedInner, dottedName)).toBe(false);
    expect(artifactIdentityKey(namespacedInner)).not.toBe(artifactIdentityKey(dottedName));
  });

  it('distinguishes target kind and metadata type', () => {
    expect(
      artifactIdentitiesEqual(
        { kind: 'apex-type', namespace: null, name: 'Widget__c' },
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
