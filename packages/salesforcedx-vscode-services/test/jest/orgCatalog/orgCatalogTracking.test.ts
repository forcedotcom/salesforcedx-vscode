/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { RemoteTrackingObservation } from '../../../src/orgCatalog/orgCatalogInternalTypes';
import * as HashMap from 'effect/HashMap';
import { compareTrackingObservations } from '../../../src/orgCatalog/orgMetadataCatalogRecorder';

const observation = (xmlName: string, fullName: string, signature: string): RemoteTrackingObservation => ({
  reference: { xmlName, fullName },
  signature
});

const observations = (entries: readonly (readonly [string, RemoteTrackingObservation])[]) => ({
  byIdentity: HashMap.fromIterable(entries),
  identityOrder: entries.map(([identity]) => identity)
});

describe('OrgMetadataCatalogRecorder tracking comparison', () => {
  it('returns added, changed, and removed references without duplicating identities', () => {
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

    expect(compareTrackingObservations(previous, current)).toEqual([
      { xmlName: 'ApexClass', fullName: 'Removed' },
      { xmlName: 'ApexClass', fullName: 'Changed' },
      { xmlName: 'ApexClass', fullName: 'Added' }
    ]);
  });

  it('returns no changes when signatures are stable', () => {
    const stable = observations([['CustomObject\0Broker__c', observation('CustomObject', 'Broker__c', '7')]]);

    expect(compareTrackingObservations(stable, stable)).toEqual([]);
  });
});
