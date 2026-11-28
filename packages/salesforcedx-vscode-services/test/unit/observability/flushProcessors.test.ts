/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { setImmediate } from 'node:timers/promises';
import { flushProcessors } from '../../../src/observability/flushProcessors';

it('settles every span and log flush before rejecting, including synchronous throws', async () => {
  const releaseSpan = Promise.withResolvers<void>();
  const releaseLog = Promise.withResolvers<void>();
  const spanError = new Error('span flush failed');
  const logError = new Error('log flush failed');
  const log = vi.fn(() => releaseLog.promise);
  let returned = false;
  const flushing = flushProcessors([
    {
      forceFlush: () => {
        throw spanError;
      }
    },
    { forceFlush: () => releaseSpan.promise },
    { forceFlush: log }
  ]).then(
    () => undefined,
    (error: unknown) => {
      returned = true;
      return error;
    }
  );
  await setImmediate();
  expect(log).toHaveBeenCalledTimes(1);
  expect(returned).toBe(false);
  releaseSpan.resolve();
  await setImmediate();
  expect(returned).toBe(false);
  releaseLog.reject(logError);
  expect(await flushing).toMatchObject({ errors: [spanError, logError] });
});
