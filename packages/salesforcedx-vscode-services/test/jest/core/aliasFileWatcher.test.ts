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
import * as Queue from 'effect/Queue';
import * as Scope from 'effect/Scope';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { URI } from 'vscode-uri';
import {
  AliasFileWatcherService,
  watchDefaultOrgAliases,
  type AliasChangeEvent
} from '../../../src/core/aliasFileWatcher';
import { AliasService } from '../../../src/core/alias';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { FileWatcherService, type FileChangeEvent } from '../../../src/vscode/fileWatcherService';

jest.mock('@salesforce/core/global', () => ({
  Global: { SFDX_DIR: '/Users/testuser/.sfdx' }
}));

const ALIAS_FILE_PATH = '/Users/testuser/.sfdx/alias.json';
const OTHER_FILE_PATH = '/Users/testuser/.sfdx/config.json';

// ---------------------------------------------------------------------------
// Layer factories
// ---------------------------------------------------------------------------

const makeFileWatcherLayer = (pubsub: PubSub.PubSub<FileChangeEvent>) =>
  Layer.succeed(FileWatcherService, new FileWatcherService({ pubsub }));

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

const makeAliasWatcherLayer = (pubsub: PubSub.PubSub<AliasChangeEvent>) =>
  Layer.succeed(AliasFileWatcherService, new AliasFileWatcherService({ pubsub }));

// ---------------------------------------------------------------------------
// AliasFileWatcherService – path-filtering integration tests
// ---------------------------------------------------------------------------

describe('AliasFileWatcherService', () => {
  const runWithMockFileWatcher = (
    fileWatcherPubSub: PubSub.PubSub<FileChangeEvent>,
    test: (aliasWatcher: AliasFileWatcherService) => Effect.Effect<void, never, Scope.Scope>
  ) => {
    // AliasFileWatcherService.Default requires FileWatcherService externally (no baked-in Default).
    // Layer.provide injects the mock FileWatcherService to satisfy that requirement.
    const layer = Layer.provide(AliasFileWatcherService.Default, makeFileWatcherLayer(fileWatcherPubSub));
    return Effect.provide(
      Effect.gen(function* () {
        const aliasWatcher = yield* AliasFileWatcherService;
        yield* test(aliasWatcher);
      }).pipe(Effect.scoped),
      layer
    );
  };

  it('publishes an alias-changed event when alias.json changes', async () => {
    const fileWatcherPubSub = await Effect.runPromise(PubSub.sliding<FileChangeEvent>(10));

    await Effect.runPromise(
      runWithMockFileWatcher(fileWatcherPubSub, aliasWatcher =>
        Effect.gen(function* () {
          const subscriber = yield* PubSub.subscribe(aliasWatcher.pubsub);

          yield* PubSub.publish(fileWatcherPubSub, { type: 'change' as const, uri: URI.file(ALIAS_FILE_PATH) });
          // wait for the 50ms debounce + scheduler time
          yield* Effect.sleep(200);

          const events: AliasChangeEvent[] = [];
          yield* Queue.takeAll(subscriber).pipe(Effect.map(chunk => events.push(...chunk)));

          expect(events).toHaveLength(1);
          expect(events[0]).toEqual({ type: 'changed' });
        })
      )
    );
  });

  it('does not publish when a non-alias file changes', async () => {
    const fileWatcherPubSub = await Effect.runPromise(PubSub.sliding<FileChangeEvent>(10));

    await Effect.runPromise(
      runWithMockFileWatcher(fileWatcherPubSub, aliasWatcher =>
        Effect.gen(function* () {
          const subscriber = yield* PubSub.subscribe(aliasWatcher.pubsub);

          yield* PubSub.publish(fileWatcherPubSub, { type: 'change' as const, uri: URI.file(OTHER_FILE_PATH) });
          yield* Effect.sleep(200);

          const events: AliasChangeEvent[] = [];
          yield* Queue.takeAll(subscriber).pipe(Effect.map(chunk => events.push(...chunk)));

          expect(events).toHaveLength(0);
        })
      )
    );
  });
});

// ---------------------------------------------------------------------------
// watchDefaultOrgAliases – reactor integration tests
// ---------------------------------------------------------------------------

describe('watchDefaultOrgAliases', () => {
  beforeEach(async () => {
    await Effect.runPromise(
      getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.set(ref, {})))
    );
  });

  const runReactorTest = async (
    getAliasesFromUsernameMock: jest.Mock,
    initialOrgInfo: { username?: string; aliases?: string[] }
  ) => {
    const aliasPubSub = await Effect.runPromise(PubSub.sliding<AliasChangeEvent>(10));
    const layer = Layer.mergeAll(makeAliasWatcherLayer(aliasPubSub), makeAliasServiceLayer(getAliasesFromUsernameMock));

    return Effect.runPromise(
      Effect.gen(function* () {
        const ref = yield* getDefaultOrgRef();
        yield* SubscriptionRef.set(ref, initialOrgInfo as { username?: string; aliases?: string[] });

        const fiber = yield* Effect.provide(Effect.scoped(watchDefaultOrgAliases()), layer).pipe(Effect.fork);

        // Yield to allow the forked reactor fiber to subscribe before we publish
        yield* Effect.sleep(0);

        yield* PubSub.publish(aliasPubSub, { type: 'changed' as const });
        yield* Effect.sleep(50);

        const result = yield* SubscriptionRef.get(ref);

        yield* Fiber.interrupt(fiber);

        return result;
      })
    );
  };

  it('updates aliases when a change event arrives', async () => {
    const mock = jest.fn().mockReturnValue(Effect.succeed(['myAlias', 'otherAlias']));
    const result = await runReactorTest(mock, { username: 'user@example.com', aliases: ['myAlias'] });
    expect(result.aliases).toEqual(['myAlias', 'otherAlias']);
  });

  it('preserves the primary alias at position 0 when disk order differs', async () => {
    const mock = jest.fn().mockReturnValue(Effect.succeed(['newAlias', 'originalAlias']));
    const result = await runReactorTest(mock, { username: 'user@example.com', aliases: ['originalAlias'] });
    expect(result.aliases).toEqual(['originalAlias', 'newAlias']);
  });

  it('falls back to disk order when primary alias was deleted externally', async () => {
    const mock = jest.fn().mockReturnValue(Effect.succeed(['remainingAlias']));
    const result = await runReactorTest(mock, { username: 'user@example.com', aliases: ['deletedAlias'] });
    expect(result.aliases).toEqual(['remainingAlias']);
  });

  it('is a no-op when there is no active username in defaultOrgRef', async () => {
    const mock = jest.fn();
    await runReactorTest(mock, {});
    expect(mock).not.toHaveBeenCalled();
  });
});
