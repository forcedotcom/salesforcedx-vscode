/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExportResultCode, type ExportResult } from '@opentelemetry/core';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';

export const finishFlush = (results: readonly PromiseSettledResult<void>[]) => {
  const failures = results.flatMap((result): unknown[] => (result.status === 'rejected' ? [result.reason] : []));
  if (failures.length === 1) return Promise.reject(failures[0]);
  return failures.length > 0
    ? Promise.reject(new AggregateError(failures, 'Telemetry export flush failed'))
    : Promise.resolve();
};

/** Track public span/log export callbacks; native processor flush promises omit some already-started exports. */
export const trackExportCallbacks = <A>(exporter: {
  export: (items: A[], callback: (result: ExportResult) => void) => void;
  shutdown: () => Promise<void>;
  forceFlush?: () => Promise<void>;
}) => {
  const pending = new Set<Deferred.Deferred<ExportResult>>();
  const awaitExports = async () => {
    const results = await Promise.allSettled(
      [...pending].map(async completed => {
        const result = await completed.pipe(Deferred.await, Effect.runPromise);
        // eslint-disable-next-line functional/no-throw-statements -- Reject the native flush Promise with the SDK's original export failure.
        if (result.code !== ExportResultCode.SUCCESS) throw result.error ?? new Error('Telemetry export failed');
      })
    );
    await finishFlush(results);
  };
  return {
    export: (items: A[], callback: (result: ExportResult) => void) => {
      const completed = Deferred.makeUnsafe<ExportResult>();
      pending.add(completed);
      // eslint-disable-next-line functional/no-try-statements -- Native exporters may throw before invoking their public completion callback.
      try {
        exporter.export(items, result => {
          pending.delete(completed);
          Deferred.doneUnsafe(completed, Effect.succeed(result));
          callback(result);
        });
      } catch (defect) {
        pending.delete(completed);
        Deferred.doneUnsafe(completed, Exit.die(defect));
        // eslint-disable-next-line functional/no-throw-statements -- Preserve the exception at the SDK's native export boundary.
        throw defect;
      }
    },
    forceFlush: async () => {
      const active = await Promise.allSettled([awaitExports()]);
      const delegate = await Promise.allSettled([Promise.resolve().then(() => exporter.forceFlush?.())]);
      await finishFlush([...active, ...delegate]);
    },
    shutdown: async () => {
      const active = await Promise.allSettled([awaitExports()]);
      const shutdown = await Promise.allSettled([Promise.resolve().then(() => exporter.shutdown())]);
      await finishFlush([...active, ...shutdown]);
    }
  };
};
