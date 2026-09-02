/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { TransmogrifierService, type DescribeSObjectResult } from '../../../src/core/transmogrifierService';

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
});
