/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { watchAliasFile } from '../../../src/core/aliasFileWatcher';
import { AliasService } from '../../../src/core/alias';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';

jest.mock('@salesforce/core/global', () => ({
  Global: { SFDX_DIR: '/Users/testuser/.sfdx' }
}));

type WatcherCallback = (...args: unknown[]) => void;

const watcherCallbacks: { create?: WatcherCallback; change?: WatcherCallback; delete?: WatcherCallback } = {};
const disposeMock = jest.fn();

beforeEach(() => {
  watcherCallbacks.create = undefined;
  watcherCallbacks.change = undefined;
  watcherCallbacks.delete = undefined;
  disposeMock.mockClear();

  (vscode.workspace.createFileSystemWatcher as jest.Mock).mockReturnValue({
    onDidCreate: jest.fn((cb: WatcherCallback) => { watcherCallbacks.create = cb; }),
    onDidChange: jest.fn((cb: WatcherCallback) => { watcherCallbacks.change = cb; }),
    onDidDelete: jest.fn((cb: WatcherCallback) => { watcherCallbacks.delete = cb; }),
    dispose: disposeMock
  });
});

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
    await Effect.runPromise(
      getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.set(ref, {})))
    );
  });

  const runWatcherTest = async (
    getAliasesFromUsernameMock: jest.Mock,
    initialOrgInfo: { username?: string; aliases?: string[] }
  ) => {
    const layer = makeAliasServiceLayer(getAliasesFromUsernameMock);

    return Effect.runPromise(
      Effect.gen(function* () {
        const ref = yield* getDefaultOrgRef();
        yield* SubscriptionRef.set(ref, initialOrgInfo as { username?: string; aliases?: string[] });

        const fiber = yield* Effect.provide(Effect.scoped(watchAliasFile()), layer).pipe(Effect.fork);
        yield* Effect.sleep(0);

        watcherCallbacks.change!();
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

  it('disposes the watcher when the fiber is interrupted', async () => {
    const mock = jest.fn().mockReturnValue(Effect.succeed(['alias']));
    const layer = makeAliasServiceLayer(mock);

    await Effect.runPromise(
      Effect.gen(function* () {
        const ref = yield* getDefaultOrgRef();
        yield* SubscriptionRef.set(ref, { username: 'user@example.com' });

        const fiber = yield* Effect.provide(Effect.scoped(watchAliasFile()), layer).pipe(Effect.fork);
        yield* Effect.sleep(0);
        yield* Fiber.interrupt(fiber);
      })
    );

    expect(disposeMock).toHaveBeenCalled();
  });
});
