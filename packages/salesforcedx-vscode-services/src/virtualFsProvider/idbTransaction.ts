/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { unknownToErrorCause } from '../core/shared';
import { VirtualFsProviderError } from './virtualFsProviderError';

const IDB_TRANSACTION_TIMEOUT = Duration.seconds(5);

type IdbRequestHandlers<A> = Pick<IDBRequest<A>, 'result' | 'error' | 'onsuccess' | 'onerror'>;
type IdbTransactionHandlers = Pick<IDBTransaction, 'error' | 'oncomplete' | 'onabort' | 'onerror' | 'abort'>;

/** Wait for the IDB transaction to complete (not just request.onsuccess). A follow-up
 * transaction started from onsuccess can hang in the extension-host worker. Timeout aborts
 * the transaction so the next `db.transaction()` is not blocked. */
export const settleIdbTransaction = <A>(
  transaction: IdbTransactionHandlers,
  request: IdbRequestHandlers<A>,
  mode: IDBTransactionMode,
  timeout: Duration.DurationInput = IDB_TRANSACTION_TIMEOUT
) =>
  Effect.async<A, VirtualFsProviderError>(resume => {
    const fail = (error: unknown, message: string): void => {
      resume(Effect.fail(new VirtualFsProviderError({ ...unknownToErrorCause(error), message })));
    };
    request.onerror = (): void => {
      fail(request.error, `Transaction failed with mode "${mode}"`);
    };
    transaction.oncomplete = (): void => {
      resume(Effect.succeed(request.result));
    };
    transaction.onabort = (): void => {
      fail(transaction.error, `Transaction aborted with mode "${mode}"`);
    };
    transaction.onerror = (): void => {
      fail(transaction.error, `Transaction failed with mode "${mode}"`);
    };
    return Effect.sync(() => {
      // eslint-disable-next-line functional/no-try-statements
      try {
        transaction.abort();
      } catch {
        // already complete — abort() throws InvalidStateError
      }
    });
  }).pipe(
    Effect.timeoutFail({
      duration: timeout,
      onTimeout: () =>
        new VirtualFsProviderError({
          message: `IndexedDB ${mode} transaction timed out`
        })
    })
  );
