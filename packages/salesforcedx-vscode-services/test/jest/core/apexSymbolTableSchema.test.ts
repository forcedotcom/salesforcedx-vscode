/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import {
  ApexSymbolTableSchemas,
  RawApexTypeReferenceSchema,
  RawApexTypeStubResponseSchema
} from '../../../src/core/apexSymbolTableSchema';
import * as responseFixture from './fixtures/apexSymbolTableResponse.json';

describe('Apex Symbol Table raw response schemas', () => {
  it('decodes representative class, interface, enum, trigger, managed-package, and compile-error stubs', () => {
    const response = Schema.decodeUnknownSync(RawApexTypeStubResponseSchema)(responseFixture);

    expect(response.typeStubs.map(stub => stub.kind)).toEqual(['CLASS', 'INTERFACE', 'ENUM', 'TRIGGER', 'CLASS']);
    expect(response.typeStubs[0]).toMatchObject({
      name: 'ManagedOuter',
      namespacePrefix: 'ExamplePkg',
      documentation: 'Managed class documentation.'
    });
    expect(response.typeStubs[0].innerTypes?.[0].name).toBe('ManagedOuter.Inner');
    expect(response.typeStubs[3]).toMatchObject({
      triggerOperations: ['AFTER INSERT', 'BEFORE UPDATE'],
      triggerObjectType: { namespacePrefix: 'Schema', name: 'Account' }
    });
    expect(response.typeStubs[4]).toMatchObject({
      compileError: 'Unexpected token near line 4',
      fields: null,
      methods: null
    });
  });

  it('preserves recursive nested generic arguments', () => {
    const reference = Schema.decodeUnknownSync(RawApexTypeReferenceSchema)({
      namespacePrefix: 'System',
      name: 'List',
      typeParameters: [
        {
          name: 'Set',
          typeParameters: [
            {
              name: 'Map',
              typeParameters: [{ name: 'String' }, { name: 'Object', typeParameters: null }]
            }
          ]
        }
      ]
    });

    expect(reference.typeParameters?.[0].typeParameters?.[0].typeParameters?.map(type => type.name)).toEqual([
      'String',
      'Object'
    ]);
  });

  it('accepts omitted and explicit-null optional provider fields without normalizing them yet', () => {
    expect(
      Schema.decodeUnknownSync(ApexSymbolTableSchemas.TypeStub)({
        name: 'Minimal',
        kind: 'CLASS'
      })
    ).toEqual({ name: 'Minimal', kind: 'CLASS' });
    expect(
      Schema.decodeUnknownSync(ApexSymbolTableSchemas.TypeStub)({
        name: 'NullHeavy',
        namespacePrefix: null,
        kind: 'CLASS',
        modifiers: null,
        annotations: null,
        compileError: null
      })
    ).toEqual({
      name: 'NullHeavy',
      namespacePrefix: null,
      kind: 'CLASS',
      modifiers: null,
      annotations: null,
      compileError: null
    });
  });

  it('rejects malformed type kinds and type references', () => {
    expect(() =>
      Schema.decodeUnknownSync(RawApexTypeStubResponseSchema)({
        typeStubs: [{ name: 'BadKind', kind: 'STRUCT' }]
      })
    ).toThrow('CLASS');
    expect(() => Schema.decodeUnknownSync(RawApexTypeReferenceSchema)({ namespacePrefix: 'System' })).toThrow('name');
  });
});
