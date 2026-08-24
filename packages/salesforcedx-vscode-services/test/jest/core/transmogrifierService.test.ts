/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { TransmogrifierService, type DescribeSObjectResult } from '../../../src/core/transmogrifierService';
import * as symbolTableResponse from './fixtures/apexSymbolTableResponse.json';

const describeResult = {
  name: 'Broker__c',
  label: 'Broker',
  custom: true,
  queryable: true,
  fields: [
    {
      name: 'Zed__c',
      label: 'Zed',
      type: 'string',
      custom: true,
      aggregatable: true,
      defaultValue: null,
      extraTypeInfo: null,
      filterable: true,
      groupable: true,
      inlineHelpText: null,
      length: 80,
      nillable: true,
      picklistValues: [],
      referenceTo: [],
      relationshipName: null,
      sortable: true
    },
    {
      name: 'Account__c',
      label: 'Account',
      type: 'reference',
      custom: true,
      aggregatable: false,
      defaultValue: null,
      extraTypeInfo: null,
      filterable: true,
      groupable: false,
      inlineHelpText: 'Related account',
      nillable: false,
      picklistValues: [],
      referenceTo: ['Account'],
      relationshipName: 'Account__r',
      sortable: true
    }
  ],
  childRelationships: [{ childSObject: 'Deal__c', field: 'Broker__c', relationshipName: 'Deals__r' }]
} as unknown as DescribeSObjectResult;

const run = <A, E>(effect: Effect.Effect<A, E, TransmogrifierService>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provide(TransmogrifierService.Default)));

describe('TransmogrifierService', () => {
  it('preserves the existing minimal SObject operation', async () => {
    const result = await run(
      TransmogrifierService.pipe(Effect.flatMap(service => service.toMinimalSObject(describeResult)))
    );

    expect(result.name).toBe('Broker__c');
    expect(result.fields.map(field => field.name)).toEqual(['Zed__c', 'Account__c']);
    expect(result.fields[1]).toMatchObject({ referenceTo: ['Account'], relationshipName: 'Account__r' });
  });

  it('transforms REST Describe through one discriminated canonical boundary', async () => {
    const result = await run(
      TransmogrifierService.pipe(
        Effect.flatMap(service =>
          service.toSemanticModel({
            source: 'rest-sobject-describe',
            identity: { kind: 'sobject', namespace: null, name: 'Broker__c' },
            value: describeResult
          })
        )
      )
    );

    expect(result).toMatchObject({
      kind: 'sobject',
      value: {
        identity: { kind: 'sobject', namespace: null, name: 'Broker__c' },
        label: 'Broker',
        custom: true,
        queryable: true
      }
    });
    expect(result.value.fields.map(field => field.name)).toEqual(['Account__c', 'Zed__c']);
    expect(result.value.fields[0]).toMatchObject({
      referenceTo: ['Account'],
      runtimeCapabilities: { filterable: true, nillable: false }
    });
  });

  it('transforms SDR-parsed workspace metadata without inventing runtime capabilities', async () => {
    const objectUri = URI.file('/workspace/force-app/main/default/objects/Broker__c/Broker__c.object-meta.xml');
    const accountFieldUri = URI.file(
      '/workspace/force-app/main/default/objects/Broker__c/fields/Account__c.field-meta.xml'
    );
    const incompleteFieldUri = URI.file(
      '/workspace/force-app/main/default/objects/Broker__c/fields/Incomplete__c.field-meta.xml'
    );
    const result = await run(
      TransmogrifierService.pipe(
        Effect.flatMap(service =>
          service.toSemanticModel({
            source: 'workspace-sobject-metadata',
            identity: { kind: 'sobject', namespace: null, name: 'Broker__c' },
            value: {
              object: {
                fullName: 'Broker__c',
                definitionUri: objectUri,
                metadata: {
                  CustomObject: {
                    label: 'Broker',
                    pluralLabel: 'Brokers',
                    nameField: { label: 'Broker Number', type: 'AutoNumber' },
                    fields: {
                      fullName: 'Legacy__c',
                      label: 'Legacy',
                      type: 'Checkbox',
                      defaultValue: 'false'
                    }
                  }
                }
              },
              fields: [
                {
                  fullName: 'Broker__c.Account__c',
                  definitionUri: accountFieldUri,
                  metadata: {
                    CustomField: {
                      fullName: 'Account__c',
                      label: 'Account',
                      type: 'Lookup',
                      referenceTo: 'Account',
                      relationshipName: 'Account__r',
                      inlineHelpText: 'Related account'
                    }
                  }
                },
                {
                  fullName: 'Broker__c.Incomplete__c',
                  definitionUri: incompleteFieldUri,
                  metadata: { CustomField: { label: 'Incomplete' } }
                }
              ]
            }
          })
        )
      )
    );

    expect(result).toMatchObject({
      kind: 'sobject',
      value: {
        identity: { kind: 'sobject', namespace: null, name: 'Broker__c' },
        label: 'Broker',
        pluralLabel: 'Brokers',
        custom: true,
        definitionUri: objectUri
      }
    });
    expect(result.value.fields.map(field => field.name)).toEqual(['Account__c', 'Incomplete__c', 'Legacy__c', 'Name']);
    expect(result.value.fields[0]).toMatchObject({
      type: 'reference',
      referenceTo: ['Account'],
      relationshipName: 'Account__r',
      definitionUri: accountFieldUri
    });
    expect(result.value.fields[0]).not.toHaveProperty('runtimeCapabilities');
    expect(result.value.fields[1]).toEqual({
      name: 'Incomplete__c',
      label: 'Incomplete',
      custom: true,
      definitionUri: incompleteFieldUri
    });
    expect(result.value.fields[3]).toMatchObject({ name: 'Name', type: 'string', custom: false });
  });

  it('validates and normalizes recursive Symbol Table Apex payloads', async () => {
    const result = await run(
      TransmogrifierService.pipe(
        Effect.flatMap(service =>
          service.toSemanticModel({
            source: 'symbol-table-apex',
            identity: { kind: 'apex-type', namespace: 'examplepkg', name: 'managedouter' },
            value: symbolTableResponse.typeStubs[0]
          })
        )
      )
    );

    expect(result).toMatchObject({
      kind: 'apex-type-stub',
      identity: { kind: 'apex-type', namespace: 'ExamplePkg', name: 'ManagedOuter' },
      value: {
        namespacePrefix: 'ExamplePkg',
        name: 'ManagedOuter',
        kind: 'CLASS',
        documentation: 'Managed class documentation.',
        compileError: null
      }
    });
    if (result.kind !== 'apex-type-stub') throw new Error('Expected an Apex type stub');
    expect(result.value.interfaces[0]).toEqual({
      namespacePrefix: 'System',
      name: 'Iterator',
      typeParameters: [
        {
          namespacePrefix: null,
          name: 'List',
          typeParameters: [{ namespacePrefix: null, name: 'String', typeParameters: null }]
        }
      ]
    });
    expect(result.value.fields[0]).toMatchObject({
      name: 'items',
      definingType: { namespacePrefix: 'ExamplePkg', name: 'ManagedBase' }
    });
    expect(result.value.properties[0]).toMatchObject({
      name: 'value',
      getter: { documentation: 'Reads the value.' },
      setter: null
    });
    expect(result.value.methods[0]).toMatchObject({
      name: 'convert',
      documentation: 'Converts an input value.',
      parameters: [{ name: 'input', documentation: null }]
    });
    expect(result.value.innerTypes[0]).toMatchObject({
      name: 'ManagedOuter.Inner',
      namespacePrefix: 'ExamplePkg'
    });
  });

  it('preserves compile errors while completing omitted canonical fields', async () => {
    const result = await run(
      TransmogrifierService.pipe(
        Effect.flatMap(service =>
          service.toSemanticModel({
            source: 'symbol-table-apex',
            identity: { kind: 'apex-type', namespace: null, name: 'BrokenType' },
            value: symbolTableResponse.typeStubs[4]
          })
        )
      )
    );

    expect(result).toMatchObject({
      kind: 'apex-type-stub',
      value: {
        fields: [],
        methods: [],
        innerTypes: [],
        compileError: 'Unexpected token near line 4'
      }
    });
  });

  it('orders unordered Symbol Table collections deterministically without reordering parameters', async () => {
    const result = await run(
      TransmogrifierService.pipe(
        Effect.flatMap(service =>
          service.toSemanticModel({
            source: 'symbol-table-apex',
            identity: { kind: 'apex-type', namespace: 'System', name: 'String' },
            value: {
              name: 'String',
              namespacePrefix: 'System',
              kind: 'CLASS',
              modifiers: ['virtual', 'global'],
              fields: [
                { name: 'Z_VALUE', modifiers: ['static', 'global'] },
                { name: 'A_VALUE', modifiers: ['global', 'static'] }
              ],
              methods: [
                {
                  name: 'valueOf',
                  parameters: [
                    { name: 'first', type: { name: 'Object' } },
                    { name: 'second', type: { name: 'String' } }
                  ]
                },
                { name: 'compareTo' }
              ]
            }
          })
        )
      )
    );

    if (result.kind !== 'apex-type-stub') throw new Error('Expected an Apex type stub');
    expect(result.value.modifiers).toEqual(['global', 'virtual']);
    expect(result.value.fields.map(field => field.name)).toEqual(['A_VALUE', 'Z_VALUE']);
    expect(result.value.methods.map(method => method.name)).toEqual(['compareTo', 'valueOf']);
    expect(result.value.methods[1].parameters.map(parameter => parameter.name)).toEqual(['first', 'second']);
  });

  it('rejects malformed and identity-mismatched Symbol Table payloads with typed errors', async () => {
    const malformed = await run(
      TransmogrifierService.pipe(
        Effect.flatMap(service =>
          service.toSemanticModel({
            source: 'symbol-table-apex',
            identity: { kind: 'apex-type', namespace: null, name: 'Broken' },
            value: { name: 'Broken', kind: 'CLASS', fields: [{ name: '' }] }
          })
        ),
        Effect.either
      )
    );
    expect(malformed).toMatchObject({
      _tag: 'Left',
      left: {
        _tag: 'TransmogrifierError',
        source: 'symbol-table-apex',
        message: 'Failed to validate the Symbol Table Apex payload'
      }
    });

    const mismatched = await run(
      TransmogrifierService.pipe(
        Effect.flatMap(service =>
          service.toSemanticModel({
            source: 'symbol-table-apex',
            identity: { kind: 'apex-type', namespace: 'OtherPackage', name: 'ManagedOuter' },
            value: symbolTableResponse.typeStubs[0]
          })
        ),
        Effect.either
      )
    );
    expect(mismatched).toMatchObject({
      _tag: 'Left',
      left: {
        _tag: 'TransmogrifierError',
        source: 'symbol-table-apex',
        message: 'Symbol Table Apex payload identity does not match the requested artifact identity'
      }
    });
  });
});
