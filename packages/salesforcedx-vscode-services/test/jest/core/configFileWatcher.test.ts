/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { URI } from 'vscode-uri';
import { AliasService } from '../../../src/core/alias';
import { ConfigService } from '../../../src/core/configService';
import { watchConfigFiles } from '../../../src/core/configFileWatcher';
import { ConnectionService } from '../../../src/core/connectionService';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { FileChangePubSub, type FileChangeEvent } from '../../../src/vscode/fileChangePubSub';

jest.mock('@salesforce/core/global', () => ({
  ...jest.requireActual('@salesforce/core/global'),
  Global: {
    SF_DIR: '/Users/test/.sf',
    SFDX_DIR: '/Users/test/.sfdx',
    SF_STATE_FOLDER: '.sf'
  }
}));

describe('watchConfigFiles', () => {
  const makeLayer = (pubsub: PubSub.PubSub<FileChangeEvent>, resolvedUsername: string) => {
    const invalidateConfigAggregator = jest.fn(() => Effect.void);
    const invalidateCachedConnections = jest.fn(() => Effect.void);
    const getConnection = jest.fn(() => Effect.succeed({} as never));
    const layer = Layer.mergeAll(
      Layer.succeed(FileChangePubSub, pubsub as unknown as FileChangePubSub),
      Layer.succeed(
        AliasService,
        AliasService.make({
          getAllAliases: () => Effect.succeed({}),
          getAliasesFromUsername: () => Effect.succeed([]),
          getUsernameFromAlias: () => Effect.succeed(Option.some(resolvedUsername)),
          unsetAliases: () => Effect.void
        })
      ),
      Layer.succeed(
        ConfigService,
        ConfigService.make({
          getTargetOrg: () => Effect.succeed('configured-alias'),
          invalidateConfigAggregator
        } as never)
      ),
      Layer.succeed(ConnectionService, ConnectionService.make({ invalidateCachedConnections, getConnection } as never))
    );
    return { getConnection, invalidateCachedConnections, invalidateConfigAggregator, layer };
  };

  beforeEach(async () => {
    await Effect.runPromise(
      getDefaultOrgRef().pipe(
        Effect.flatMap(ref => SubscriptionRef.set(ref, { username: 'current@example.com', orgId: '00D-current' }))
      )
    );
  });

  it('refreshes the effective target org when its alias resolves to another username', async () => {
    const pubsub = await Effect.runPromise(PubSub.sliding<FileChangeEvent>(10));
    const { getConnection, invalidateCachedConnections, invalidateConfigAggregator, layer } = makeLayer(
      pubsub,
      'replacement@example.com'
    );

    const fiber = Effect.runFork(Effect.provide(watchConfigFiles(), layer));
    await Effect.runPromise(Effect.sleep(10));
    await Effect.runPromise(
      PubSub.publish(pubsub, { type: 'change' as const, uri: URI.file('/Users/test/.sfdx/alias.json') })
    );
    await Effect.runPromise(Effect.sleep(100));
    await Effect.runPromise(Fiber.interrupt(fiber));

    expect(invalidateConfigAggregator).toHaveBeenCalledTimes(1);
    expect(invalidateCachedConnections).toHaveBeenCalledTimes(1);
    expect(getConnection).toHaveBeenCalledTimes(1);
  });

  it('ignores alias changes that retain the configured target-org resolution', async () => {
    const pubsub = await Effect.runPromise(PubSub.sliding<FileChangeEvent>(10));
    const { getConnection, invalidateCachedConnections, invalidateConfigAggregator, layer } = makeLayer(
      pubsub,
      'current@example.com'
    );

    const fiber = Effect.runFork(Effect.provide(watchConfigFiles(), layer));
    await Effect.runPromise(Effect.sleep(10));
    await Effect.runPromise(
      PubSub.publish(pubsub, { type: 'change' as const, uri: URI.file('/Users/test/.sfdx/alias.json') })
    );
    await Effect.runPromise(Effect.sleep(100));
    await Effect.runPromise(Fiber.interrupt(fiber));

    expect(invalidateConfigAggregator).not.toHaveBeenCalled();
    expect(invalidateCachedConnections).not.toHaveBeenCalled();
    expect(getConnection).not.toHaveBeenCalled();
  });
});
