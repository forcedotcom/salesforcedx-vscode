/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { finishFlush } from './exportCallbacks';

/** Native SDK flush failures must not detach other processor flushes or skip log processors. */
export const flushProcessors = async (processors: readonly { forceFlush: () => Promise<void> }[]) => {
  const results = await Promise.allSettled(
    processors.map(async processor => {
      await processor.forceFlush();
    })
  );
  await finishFlush(results);
};
