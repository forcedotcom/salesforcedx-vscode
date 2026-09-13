/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { URI } from 'vscode-uri';
import { ConfigService } from '../../../src/core/configService';
import { watchConfigFiles } from '../../../src/core/configFileWatcher';
import { ConnectionService } from '../../../src/core/connectionService';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { HostFileNotFoundError, HostFileWatchError, HostFileWatcher } from '../../../src/core/hostFileWatcher';
import { FileChangePubSub, type FileChangeEvent } from '../../../src/vscode/fileChangePubSub';

jest.mock('@salesforce/core/global', () => ({
  ...jest.requireActual('@salesforce/core/global'),
  Global: {
    SF_DIR: '/Users/test/.sf',
    SFDX_DIR: '/Users/test/.sfdx',
    SF_STATE_FOLDER: '.sf'
  }
}));

const PROJECT_CONFIG = '/Users/test/project/.sf/config.json';
const GLOBAL_CONFIG = '/Users/test/.sf/config.json';
const ALIAS_FILE = '/Users/test/.sfdx/alias.json';

describe('watchConfigFiles', () => {
  const makeLayer = (workspacePubsub: PubSub.PubSub<FileChangeEvent>, hostWatch: HostFileWatcher['watch']) => {
    const invalidateConfigAggregator = jest.fn(() => Effect.void);
    const invalidateCachedConnections = jest.fn(() => Effect.void);
    const getConnection = jest.fn(() => Effect.succeed({} as never));
    const layer = Layer.mergeAll(
      Layer.succeed(FileChangePubSub, workspacePubsub as unknown as FileChangePubSub),
      Layer.succeed(HostFileWatcher, { watch: hostWatch } as unknown as HostFileWatcher),
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

  const publishAndSettle = async (
    fiber: Fiber.RuntimeFiber<void, unknown>,
    pubsub: PubSub.PubSub<FileChangeEvent>,
    uri: string
  ) => {
    await Effect.runPromise(Effect.sleep(10));
    await Effect.runPromise(PubSub.publish(pubsub, { type: 'change' as const, uri: URI.file(uri) }));
    await Effect.runPromise(Effect.sleep(100));
    await fiber.pipe(Fiber.interrupt, Effect.runPromise);
  };

  beforeEach(async () => {
    await Effect.runPromise(
      getDefaultOrgRef().pipe(
        Effect.flatMap(ref => SubscriptionRef.set(ref, { username: 'current@example.com', orgId: '00D-current' }))
      )
    );
  });

  it('refreshes when project .sf/config.json changes', async () => {
    const workspacePubsub = await Effect.runPromise(PubSub.sliding<FileChangeEvent>(10));
    const hostPubsub = await Effect.runPromise(PubSub.sliding<FileChangeEvent>(10));
    const { getConnection, invalidateCachedConnections, invalidateConfigAggregator, layer } = makeLayer(
      workspacePubsub,
      () => Stream.fromPubSub(hostPubsub)
    );

    const fiber = Effect.runFork(Effect.provide(watchConfigFiles(), layer));
    await publishAndSettle(fiber, workspacePubsub, PROJECT_CONFIG);

    expect(invalidateConfigAggregator).toHaveBeenCalledTimes(1);
    expect(invalidateCachedConnections).toHaveBeenCalledTimes(1);
    expect(getConnection).toHaveBeenCalledTimes(1);
  });

  it('refreshes when global ~/.sf/config.json changes', async () => {
    const workspacePubsub = await Effect.runPromise(PubSub.sliding<FileChangeEvent>(10));
    const hostPubsub = await Effect.runPromise(PubSub.sliding<FileChangeEvent>(10));
    const { getConnection, invalidateCachedConnections, invalidateConfigAggregator, layer } = makeLayer(
      workspacePubsub,
      () => Stream.fromPubSub(hostPubsub)
    );

    const fiber = Effect.runFork(Effect.provide(watchConfigFiles(), layer));
    await publishAndSettle(fiber, hostPubsub, GLOBAL_CONFIG);

    expect(invalidateConfigAggregator).toHaveBeenCalledTimes(1);
    expect(invalidateCachedConnections).toHaveBeenCalledTimes(1);
    expect(getConnection).toHaveBeenCalledTimes(1);
  });

  it('ignores workspace alias.json on FileChangePubSub', async () => {
    const workspacePubsub = await Effect.runPromise(PubSub.sliding<FileChangeEvent>(10));
    const hostPubsub = await Effect.runPromise(PubSub.sliding<FileChangeEvent>(10));
    const { getConnection, invalidateCachedConnections, invalidateConfigAggregator, layer } = makeLayer(
      workspacePubsub,
      () => Stream.fromPubSub(hostPubsub)
    );

    const fiber = Effect.runFork(Effect.provide(watchConfigFiles(), layer));
    await publishAndSettle(fiber, workspacePubsub, ALIAS_FILE);

    expect(invalidateConfigAggregator).not.toHaveBeenCalled();
    expect(invalidateCachedConnections).not.toHaveBeenCalled();
    expect(getConnection).not.toHaveBeenCalled();
  });

  it('keeps watching project config when global host watch fails', async () => {
    const workspacePubsub = await Effect.runPromise(PubSub.sliding<FileChangeEvent>(10));
    const { getConnection, invalidateCachedConnections, invalidateConfigAggregator, layer } = makeLayer(
      workspacePubsub,
      () => Stream.fail(new HostFileWatchError({ message: 'EACCES', path: GLOBAL_CONFIG }))
    );

    const fiber = Effect.runFork(Effect.provide(watchConfigFiles(), layer));
    await publishAndSettle(fiber, workspacePubsub, PROJECT_CONFIG);

    expect(invalidateConfigAggregator).toHaveBeenCalledTimes(1);
    expect(invalidateCachedConnections).toHaveBeenCalledTimes(1);
    expect(getConnection).toHaveBeenCalledTimes(1);
  });

  it('tags missing vs other host-watch failures separately', () => {
    expect(new HostFileNotFoundError({ message: 'ENOENT', path: GLOBAL_CONFIG })._tag).toBe('HostFileNotFoundError');
    expect(new HostFileWatchError({ message: 'EACCES', path: GLOBAL_CONFIG })._tag).toBe('HostFileWatchError');
  });
});
