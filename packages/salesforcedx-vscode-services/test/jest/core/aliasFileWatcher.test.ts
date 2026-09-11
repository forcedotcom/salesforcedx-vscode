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
import { AliasService } from '../../../src/core/alias';
import { watchAliasFile } from '../../../src/core/aliasFileWatcher';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { HostFileWatcher } from '../../../src/core/hostFileWatcher';
import type { FileChangeEvent } from '../../../src/vscode/fileChangePubSub';

jest.mock('@salesforce/core/global', () => ({
  Global: { SFDX_DIR: '/Users/testuser/.sfdx' }
}));

const ALIAS_FILE_PATH = '/Users/testuser/.sfdx/alias.json';

const makeHostFileWatcherLayer = (pubsub: PubSub.PubSub<FileChangeEvent>) =>
  Layer.succeed(HostFileWatcher, { watch: () => Stream.fromPubSub(pubsub) } as unknown as HostFileWatcher);

const makeAliasServiceLayer = (getAliasesFromUsername: jest.Mock) =>
  Layer.succeed(
    AliasService,
    new AliasService({
      getAllAliases: () => Effect.succeed({}),
      getAliasesFromUsername,
      getUsernameFromAlias: () => Effect.succeed(undefined as never),
      unsetAliases: () => Effect.void
    })
  );

describe('watchAliasFile', () => {
  beforeEach(async () => {
    await Effect.runPromise(getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.set(ref, {}))));
  });

  const runWatcherTest = async (
    getAliasesFromUsernameMock: jest.Mock,
    initialOrgInfo: { username?: string; aliases?: string[] }
  ) => {
    const fileChanges = await Effect.runPromise(PubSub.sliding<FileChangeEvent>(10));
    const layer = Layer.mergeAll(
      makeHostFileWatcherLayer(fileChanges),
      makeAliasServiceLayer(getAliasesFromUsernameMock)
    );

    return Effect.runPromise(
      Effect.gen(function* () {
        const ref = yield* getDefaultOrgRef();
        yield* SubscriptionRef.set(ref, initialOrgInfo as { username?: string; aliases?: string[] });

        const fiber = yield* Effect.provide(Effect.scoped(watchAliasFile()), layer).pipe(Effect.fork);

        yield* Effect.sleep(0);

        yield* PubSub.publish(fileChanges, { type: 'change' as const, uri: URI.file(ALIAS_FILE_PATH) });
        yield* Effect.sleep(200);

        const result = yield* SubscriptionRef.get(ref);

        yield* Fiber.interrupt(fiber);

        return result;
      })
    );
  };

  it('updates aliases when alias.json changes', async () => {
    const mock = jest.fn().mockReturnValue(Effect.succeed(['myAlias', 'otherAlias']));
    const result = await runWatcherTest(mock, { username: 'user@example.com', aliases: ['myAlias'] });
    expect(result.aliases).toEqual(['myAlias', 'otherAlias']);
  });

  it('preserves the primary alias at position 0 when disk order differs', async () => {
    const mock = jest.fn().mockReturnValue(Effect.succeed(['newAlias', 'originalAlias']));
    const result = await runWatcherTest(mock, { username: 'user@example.com', aliases: ['originalAlias'] });
    expect(result.aliases).toEqual(['originalAlias', 'newAlias']);
  });

  it('falls back to disk order when primary alias was deleted externally', async () => {
    const mock = jest.fn().mockReturnValue(Effect.succeed(['remainingAlias']));
    const result = await runWatcherTest(mock, { username: 'user@example.com', aliases: ['deletedAlias'] });
    expect(result.aliases).toEqual(['remainingAlias']);
  });

  it('is a no-op when there is no active username in defaultOrgRef', async () => {
    const mock = jest.fn();
    await runWatcherTest(mock, {});
    expect(mock).not.toHaveBeenCalled();
  });
});
