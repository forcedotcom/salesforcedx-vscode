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
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { URI } from 'vscode-uri';
import { watchAliasFile } from '../../../src/core/aliasFileWatcher';
import { AliasService } from '../../../src/core/alias';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { FileChangePubSub, type FileChangeEvent } from '../../../src/vscode/fileChangePubSub';

jest.mock('@salesforce/core/global', () => ({
  Global: { SFDX_DIR: '/Users/testuser/.sfdx' }
}));

const ALIAS_FILE_PATH = '/Users/testuser/.sfdx/alias.json';
const OTHER_FILE_PATH = '/Users/testuser/.sfdx/config.json';

// ---------------------------------------------------------------------------
// Layer factories
// ---------------------------------------------------------------------------

const makeFileChangePubSubLayer = (pubsub: PubSub.PubSub<FileChangeEvent>) =>
  Layer.succeed(FileChangePubSub, pubsub as unknown as FileChangePubSub);

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

// ---------------------------------------------------------------------------
// watchAliasFile – integration tests
// ---------------------------------------------------------------------------

describe('watchAliasFile', () => {
  beforeEach(async () => {
    await Effect.runPromise(getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.set(ref, {}))));
  });

  const runWatcherTest = async (
    getAliasesFromUsernameMock: jest.Mock,
    initialOrgInfo: { username?: string; aliases?: string[] },
    publishUri: string
  ) => {
    const fileChangePubSub = await Effect.runPromise(PubSub.sliding<FileChangeEvent>(10));
    const layer = Layer.mergeAll(
      makeFileChangePubSubLayer(fileChangePubSub),
      makeAliasServiceLayer(getAliasesFromUsernameMock)
    );

    return Effect.runPromise(
      Effect.gen(function* () {
        const ref = yield* getDefaultOrgRef();
        yield* SubscriptionRef.set(ref, initialOrgInfo as { username?: string; aliases?: string[] });

        const fiber = yield* Effect.provide(Effect.scoped(watchAliasFile()), layer).pipe(Effect.fork);

        // Yield to allow the forked fiber to subscribe before we publish
        yield* Effect.sleep(0);

        yield* PubSub.publish(fileChangePubSub, { type: 'change' as const, uri: URI.file(publishUri) });
        yield* Effect.sleep(200);

        const result = yield* SubscriptionRef.get(ref);

        yield* Fiber.interrupt(fiber);

        return result;
      })
    );
  };

  it('updates aliases when alias.json changes', async () => {
    const mock = jest.fn().mockReturnValue(Effect.succeed(['myAlias', 'otherAlias']));
    const result = await runWatcherTest(mock, { username: 'user@example.com', aliases: ['myAlias'] }, ALIAS_FILE_PATH);
    expect(result.aliases).toEqual(['myAlias', 'otherAlias']);
  });

  it('preserves the primary alias at position 0 when disk order differs', async () => {
    const mock = jest.fn().mockReturnValue(Effect.succeed(['newAlias', 'originalAlias']));
    const result = await runWatcherTest(
      mock,
      { username: 'user@example.com', aliases: ['originalAlias'] },
      ALIAS_FILE_PATH
    );
    expect(result.aliases).toEqual(['originalAlias', 'newAlias']);
  });

  it('falls back to disk order when primary alias was deleted externally', async () => {
    const mock = jest.fn().mockReturnValue(Effect.succeed(['remainingAlias']));
    const result = await runWatcherTest(
      mock,
      { username: 'user@example.com', aliases: ['deletedAlias'] },
      ALIAS_FILE_PATH
    );
    expect(result.aliases).toEqual(['remainingAlias']);
  });

  it('is a no-op when there is no active username in defaultOrgRef', async () => {
    const mock = jest.fn();
    await runWatcherTest(mock, {}, ALIAS_FILE_PATH);
    expect(mock).not.toHaveBeenCalled();
  });

  it('does not update aliases when a non-alias file changes', async () => {
    const mock = jest.fn().mockReturnValue(Effect.succeed(['myAlias']));
    const result = await runWatcherTest(mock, { username: 'user@example.com', aliases: ['myAlias'] }, OTHER_FILE_PATH);
    expect(mock).not.toHaveBeenCalled();
    expect(result.aliases).toEqual(['myAlias']);
  });
});
