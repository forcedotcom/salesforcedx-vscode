/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cause from 'effect/Cause';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import { settleIdbTransaction } from '../../../src/virtualFsProvider/idbTransaction';

type IdbHandler = ((ev: Event) => void) | null;

const fire = (handler: IdbHandler, type: string): void => {
  handler?.(new Event(type));
};

const fakeIdb = (result = 'saved-key') => {
  const abort = jest.fn();
  const transaction = {
    error: null as DOMException | null,
    oncomplete: null as IdbHandler,
    onabort: null as IdbHandler,
    onerror: null as IdbHandler,
    abort
  };
  const request = {
    result,
    error: null as DOMException | null,
    onsuccess: null as IdbHandler,
    onerror: null as IdbHandler
  };
  return { transaction, request, abort };
};

describe('settleIdbTransaction', () => {
  it('succeeds when the transaction completes', async () => {
    const { transaction, request } = fakeIdb();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(settleIdbTransaction(transaction, request, 'readwrite'));
        yield* Effect.yieldNow();
        yield* Effect.sync(() => {
          fire(transaction.oncomplete, 'complete');
        });
        return yield* Fiber.join(fiber);
      })
    );
    expect(result).toBe('saved-key');
  });

  it('fails when the transaction aborts', async () => {
    const { transaction, request } = fakeIdb();
    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(settleIdbTransaction(transaction, request, 'readwrite'));
        yield* Effect.yieldNow();
        yield* Effect.sync(() => {
          fire(transaction.onabort, 'abort');
        });
        return yield* Fiber.await(fiber);
      })
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.squash(exit.cause)).toMatchObject({
        _tag: 'VirtualFsProviderError',
        message: 'Transaction aborted with mode "readwrite"'
      });
    }
  });

  it('aborts the transaction on timeout and unblocks a second write', async () => {
    const hung = fakeIdb();
    const next = fakeIdb('second-key');
    hung.abort.mockImplementation(() => {
      fire(hung.transaction.onabort, 'abort');
    });

    const hungExit = await Effect.runPromise(
      settleIdbTransaction(hung.transaction, hung.request, 'readwrite', Duration.millis(20)).pipe(Effect.exit)
    );
    expect(hung.abort).toHaveBeenCalledTimes(1);
    expect(Exit.isFailure(hungExit)).toBe(true);
    if (Exit.isFailure(hungExit)) {
      expect(Cause.squash(hungExit.cause)).toMatchObject({
        _tag: 'VirtualFsProviderError',
        message: 'IndexedDB readwrite transaction timed out'
      });
    }

    const secondResult = await Effect.runPromise(
      Effect.gen(function* () {
        const nextFiber = yield* Effect.fork(settleIdbTransaction(next.transaction, next.request, 'readwrite'));
        yield* Effect.yieldNow();
        yield* Effect.sync(() => {
          fire(next.transaction.oncomplete, 'complete');
        });
        return yield* Fiber.join(nextFiber);
      })
    );
    expect(secondResult).toBe('second-key');
  });
});
