/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
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
});
