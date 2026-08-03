/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { RemoteTrackingObservation } from '../../../src/orgCatalog/orgCatalogInternalTypes';
import { compareTrackingObservations } from '../../../src/orgCatalog/orgCatalogTracking';

const observation = (xmlName: string, fullName: string, signature: string): RemoteTrackingObservation => ({
  reference: { xmlName, fullName },
  signature
});

describe('OrgCatalogTracking', () => {
  it('returns added, changed, and removed references without duplicating identities', () => {
    const previous = new Map([
      ['ApexClass\0Removed', observation('ApexClass', 'Removed', '1')],
      ['ApexClass\0Changed', observation('ApexClass', 'Changed', '1')],
      ['ApexClass\0Stable', observation('ApexClass', 'Stable', '1')]
    ]);
    const current = new Map([
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
    const stable = new Map([['CustomObject\0Broker__c', observation('CustomObject', 'Broker__c', '7')]]);

    expect(compareTrackingObservations(stable, stable)).toEqual([]);
  });
});
