/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { ChannelService } from '../../../src/vscode/channelService';
import { ConnectionService } from '../../../src/core/connectionService';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { MetadataDescribeService } from '../../../src/core/metadataDescribeService';

type ListItem = {
  fullName: string;
  type: string;
  id?: string;
  lastModifiedDate?: string;
};

const createMockConnectionService = (listResult: ListItem | ListItem[]): Layer.Layer<ConnectionService> =>
  Layer.succeed(
    ConnectionService,
    ConnectionService.make({
      getConnection: () =>
        Effect.succeed({
          version: '60.0',
          metadata: {
            list: jest.fn().mockResolvedValue(listResult)
          }
        } as unknown as Connection),
      invalidateCachedConnections: () => Effect.void,
      listAllAuthorizations: () => Effect.succeed([]),
      loginWithAccessToken: () => Effect.succeed({} as never)
    })
  );

const seedDefaultOrg = Effect.gen(function* () {
  const ref = yield* getDefaultOrgRef();
  yield* SubscriptionRef.update(ref, () => ({ orgId: 'test-org' }));
});

const runListMetadata = (listResult: ListItem | ListItem[], type = 'ApexClass') =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* seedDefaultOrg;
      const service = yield* MetadataDescribeService;
      return yield* service.listMetadata(type);
    }).pipe(
      Effect.provide(
        Layer.provide(
          MetadataDescribeService.DefaultWithoutDependencies,
          Layer.mergeAll(createMockConnectionService(listResult), ChannelService.Default)
        )
      )
    )
  );

describe('MetadataDescribeService.listMetadata', () => {
  it('sorts an out-of-order array by fullName', async () => {
    const result = await runListMetadata([
      { fullName: 'Charlie', type: 'ApexClass' },
      { fullName: 'Alpha', type: 'ApexClass' },
      { fullName: 'Bravo', type: 'ApexClass' }
    ]);

    expect(result.map(r => r.fullName)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('wraps a non-array (single object) response into an array of one', async () => {
    const result = await runListMetadata({ fullName: 'Solo', type: 'ApexClass' });

    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('Solo');
  });

  it('deduplicates entries with the same fullName', async () => {
    const result = await runListMetadata([
      { fullName: 'Dup', type: 'ApexClass', id: '1' },
      { fullName: 'Dup', type: 'ApexClass', id: '2' },
      { fullName: 'Unique', type: 'ApexClass' }
    ]);

    expect(result.map(r => r.fullName)).toEqual(['Dup', 'Unique']);
  });

  it('handles out-of-order, duplicate, and single-fullName entries together', async () => {
    const result = await runListMetadata([
      { fullName: 'Charlie', type: 'ApexClass', id: 'c1' },
      { fullName: 'Alpha', type: 'ApexClass', id: 'a1' },
      { fullName: 'Charlie', type: 'ApexClass', id: 'c2' },
      { fullName: 'Bravo', type: 'ApexClass' },
      { fullName: 'Alpha', type: 'ApexClass', id: 'a2' }
    ]);

    expect(result.map(r => r.fullName)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });
});
