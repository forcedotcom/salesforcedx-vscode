/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  TransmogrifierService,
  SObjectSemanticModelSchema,
  type DescribeSObjectResult
} from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Schema from 'effect/Schema';
import { URI } from 'vscode-uri';
import { TransmogrifierServiceLayer } from '../../src/transmogrifierService.js';

// REST fixtures intentionally omit SDK fields discarded by the normalization boundary.
const describe = (value: unknown) => value as DescribeSObjectResult;
const field = {
  name: 'Zed__c',
  label: 'Zed',
  type: 'string',
  custom: true,
  aggregatable: true,
  filterable: true,
  groupable: true,
  nillable: true,
  sortable: true
};
const identity = { kind: 'sobject', namespace: null, name: 'Broker__c' } as const;
const raw = describe({
  name: 'Broker__c',
  label: 'Broker',
  custom: true,
  queryable: true,
  fields: [
    field,
    {
      ...field,
      name: 'Account__c',
      type: 'reference',
      referenceTo: ['Zebra', 'Account'],
      length: null,
      picklistValues: [
        { active: true, value: 'Z' },
        { active: false, value: 'A', label: null }
      ]
    }
  ],
  childRelationships: [{ childSObject: 'Deal__c', field: 'Broker__c' }]
});

it('preserves minimal REST order, defaults, nulls, and rejects missing required capabilities', async () => {
  const runtime = ManagedRuntime.make(TransmogrifierServiceLayer);
  try {
    const service = await runtime.runPromise(TransmogrifierService);
    const result = await runtime.runPromise(service.toMinimalSObject(raw));
    expect(result.fields.map(value => value.name)).toEqual(['Zed__c', 'Account__c']);
    expect(result.fields[0]).toMatchObject({
      defaultValue: null,
      extraTypeInfo: null,
      inlineHelpText: null,
      relationshipName: null,
      picklistValues: [],
      referenceTo: []
    });
    expect(result.fields[1]).not.toHaveProperty('length');
    expect(result.childRelationships[0].relationshipName).toBeNull();
    expect(
      await runtime.runPromise(
        service.toMinimalSObject(
          describe({
            name: 'Empty',
            label: 'Empty',
            custom: false,
            queryable: false,
            fields: null,
            childRelationships: undefined
          })
        )
      )
    ).toMatchObject({ fields: [], childRelationships: [] });
    expect(
      await runtime.runPromise(
        service
          .toMinimalSObject(
            describe({ name: 'Bad', label: 'Bad', custom: true, queryable: true, fields: [{ name: 'Bad' }] })
          )
          .pipe(Effect.flip)
      )
    ).toMatchObject({ _tag: 'SchemaError' });
    expect(await runtime.runPromise(service.decodeSObject({}).pipe(Effect.flip))).toMatchObject({
      _tag: 'SchemaError'
    });
  } finally {
    await runtime.dispose();
  }
});

it('sorts canonical REST facts and validates persisted identity including namespace', async () => {
  const runtime = ManagedRuntime.make(TransmogrifierServiceLayer);
  try {
    const service = await runtime.runPromise(TransmogrifierService);
    const result = await runtime.runPromise(
      service.toSemanticModel({ source: 'rest-sobject-describe', identity, value: raw })
    );
    expect(result.value.fields.map(value => value.name)).toEqual(['Account__c', 'Zed__c']);
    expect(result.value.fields[0]).toMatchObject({
      referenceTo: ['Account', 'Zebra'],
      picklistValues: [
        { value: 'A', active: false },
        { value: 'Z', active: true }
      ],
      runtimeCapabilities: { nillable: true }
    });
    const encoded = Schema.encodeSync(SObjectSemanticModelSchema)(result);
    expect(
      await runtime.runPromise(
        service.toSemanticModel({
          source: 'persisted-semantic-model',
          identity: { ...identity, name: 'BROKER__C' },
          value: encoded
        })
      )
    ).toEqual(result);
    expect(
      await runtime.runPromise(
        service
          .toSemanticModel({
            source: 'persisted-semantic-model',
            identity: { ...identity, namespace: 'pkg' },
            value: encoded
          })
          .pipe(Effect.flip)
      )
    ).toMatchObject({ _tag: 'TransmogrifierError' });
    expect(
      await runtime.runPromise(
        service.toSemanticModel({ source: 'rest-sobject-describe', identity, value: describe({}) }).pipe(Effect.flip)
      )
    ).toMatchObject({ _tag: 'TransmogrifierError', cause: { _tag: 'SchemaError' } });
  } finally {
    await runtime.dispose();
  }
});

it('normalizes SDR workspace metadata, separate field precedence, native URIs, and unknown capabilities', async () => {
  const runtime = ManagedRuntime.make(TransmogrifierServiceLayer);
  try {
    const service = await runtime.runPromise(TransmogrifierService);
    const objectUri = URI.parse('memfs:/workspace/Broker__c.object-meta.xml');
    const fieldUri = URI.parse('memfs:/workspace/Zed__c.field-meta.xml');
    const result = await runtime.runPromise(
      service.toSemanticModel({
        source: 'workspace-sobject-metadata',
        identity,
        value: {
          object: {
            fullName: identity.name,
            definitionUri: objectUri,
            metadata: {
              CustomObject: {
                label: ' Broker ',
                pluralLabel: 'Brokers',
                nameField: { type: 'AutoNumber' },
                fields: [
                  { fullName: 'ZED__C', type: 'Checkbox' },
                  { fullName: 'Old__c', length: ' 80 ', type: 'Text' }
                ]
              }
            }
          },
          fields: [
            {
              fullName: 'Broker__c.Zed__c',
              definitionUri: fieldUri,
              metadata: {
                CustomField: {
                  type: 'Lookup',
                  referenceTo: [' Zebra ', 'Account', '', null],
                  length: 'NaN',
                  precision: ' 2 ',
                  valueSet: {
                    valueSetDefinition: {
                      value: [
                        { fullName: ' Z ', isActive: 'false' },
                        { fullName: 'A', label: ' First ' }
                      ]
                    }
                  }
                }
              }
            },
            { fullName: 'Broker__c.Incomplete__c', definitionUri: fieldUri, metadata: { label: 'Incomplete' } }
          ]
        }
      })
    );
    expect(result.value.definitionUri).toBe(objectUri);
    expect(result.value.label).toBe('Broker');
    expect(result.value.fields.map(value => value.name)).toEqual(['Incomplete__c', 'Name', 'Old__c', 'Zed__c']);
    expect(result.value.fields[3]).toMatchObject({
      type: 'reference',
      referenceTo: ['Account', 'Zebra'],
      precision: 2,
      picklistValues: [
        { value: 'A', label: 'First' },
        { value: 'Z', active: false }
      ]
    });
    expect(result.value.fields[3].definitionUri).toBe(fieldUri);
    expect(result.value.fields[3]).not.toHaveProperty('length');
    expect(result.value.fields.every(value => value.runtimeCapabilities === undefined)).toBe(true);
    const stored = Schema.encodeSync(SObjectSemanticModelSchema)(result);
    const restored = await runtime.runPromise(
      service.toSemanticModel({ source: 'persisted-semantic-model', identity, value: stored })
    );
    expect(restored.value.definitionUri?.toString()).toBe(objectUri.toString());
    await runtime.dispose();
    expect(
      Exit.isFailure(
        await Effect.runPromiseExit(
          service.toSemanticModel({ source: 'persisted-semantic-model', identity, value: stored })
        )
      )
    ).toBe(true);
  } finally {
    await runtime.dispose();
  }
});

it('treats prototype-property metadata type names as strings, not inherited mappings or defects', async () => {
  const runtime = ManagedRuntime.make(TransmogrifierServiceLayer);
  try {
    const service = await runtime.runPromise(TransmogrifierService);
    const uri = URI.parse('memfs:/workspace/Object.object-meta.xml');
    const result = await runtime.runPromise(
      service.toSemanticModel({
        source: 'workspace-sobject-metadata',
        identity,
        value: {
          object: {
            fullName: identity.name,
            definitionUri: uri,
            metadata: {
              fields: ['constructor', '__proto__'].map((type, index) => ({
                fullName: `Field${index}`,
                type
              }))
            }
          },
          fields: []
        }
      })
    );
    expect(result.value.fields.map(value => value.type)).toEqual(['constructor', '__proto__']);
    expect(
      await runtime.runPromise(
        service.toSemanticModel({
          source: 'workspace-sobject-metadata',
          identity,
          value: {
            object: { fullName: identity.name, definitionUri: uri, metadata: { label: { invalid: true } } },
            fields: []
          }
        })
      )
    ).toMatchObject({ kind: 'sobject' });
  } finally {
    await runtime.dispose();
  }
});
