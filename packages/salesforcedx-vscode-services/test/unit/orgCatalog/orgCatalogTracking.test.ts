/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { RemoteTrackingObservation } from '../../../src/orgCatalog/orgCatalogInternalTypes';
import * as Effect from 'effect/Effect';
import * as HashMap from 'effect/HashMap';
import { compareTrackingObservations } from '../../../src/orgCatalog/orgMetadataCatalogRecorder';

const observation = (xmlName: string, fullName: string, signature: string): RemoteTrackingObservation => ({
  reference: { xmlName, fullName },
  signature
});

const observations = (entries: readonly (readonly [string, RemoteTrackingObservation])[]) =>
  HashMap.fromIterable(entries);

describe('OrgMetadataCatalogRecorder tracking comparison', () => {
  it('returns added, changed, and removed references without duplicating identities', async () => {
    const previous = observations([
      ['ApexClass\0Removed', observation('ApexClass', 'Removed', '1')],
      ['ApexClass\0Changed', observation('ApexClass', 'Changed', '1')],
      ['ApexClass\0Stable', observation('ApexClass', 'Stable', '1')]
    ]);
    const current = observations([
      ['ApexClass\0Changed', observation('ApexClass', 'Changed', '2')],
      ['ApexClass\0Stable', observation('ApexClass', 'Stable', '1')],
      ['ApexClass\0Added', observation('ApexClass', 'Added', '1')]
    ]);

    const changed = await Effect.runPromise(compareTrackingObservations(previous, current));
    expect(changed).toHaveLength(3);
    expect(changed).toEqual(
      expect.arrayContaining([
        { xmlName: 'ApexClass', fullName: 'Removed' },
        { xmlName: 'ApexClass', fullName: 'Changed' },
        { xmlName: 'ApexClass', fullName: 'Added' }
      ])
    );
  });

  it('returns no changes when signatures are stable', async () => {
    const stable = observations([['CustomObject\0Broker__c', observation('CustomObject', 'Broker__c', '7')]]);

    expect(await Effect.runPromise(compareTrackingObservations(stable, stable))).toEqual([]);
  });

  it('reports every addition or removal when the other snapshot is empty', async () => {
    const snapshot = observations([
      ['ApexClass\0Foo', observation('ApexClass', 'Foo', '1')],
      ['CustomObject\0Broker__c', observation('CustomObject', 'Broker__c', '2')]
    ]);
    const references = HashMap.toValues(snapshot).map(value => value.reference);

    const added = await Effect.runPromise(compareTrackingObservations(HashMap.empty(), snapshot));
    const removed = await Effect.runPromise(compareTrackingObservations(snapshot, HashMap.empty()));
    expect(added).toEqual(expect.arrayContaining(references));
    expect(added).toHaveLength(2);
    expect(removed).toEqual(expect.arrayContaining(references));
    expect(removed).toHaveLength(2);
    expect(await Effect.runPromise(compareTrackingObservations(HashMap.empty(), HashMap.empty()))).toEqual([]);
  });

  it('compares snapshots spanning multiple stream chunks', async () => {
    const previous = observations(
      Array.from(
        { length: 10_000 },
        (_, index) => [`ApexClass\0Class${index}`, observation('ApexClass', `Class${index}`, '1')] as const
      )
    );
    const current = HashMap.map(previous, value => ({ ...value, signature: '2' }));
    const changed = await Effect.runPromise(compareTrackingObservations(previous, current));

    expect(changed).toHaveLength(HashMap.size(current));
    expect(new Set(changed.map(reference => reference.fullName)).size).toBe(HashMap.size(current));
    expect(await Effect.runPromise(compareTrackingObservations(previous, previous))).toEqual([]);
  });
});
