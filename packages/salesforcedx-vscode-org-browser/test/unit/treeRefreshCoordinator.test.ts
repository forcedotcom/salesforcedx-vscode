/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { makeTreeRefreshCoordinator } from '../../src/tree/treeRefreshCoordinator';

describe('tree refresh coordinator', () => {
  it('coalesces requests made while a root projection is active', async () => {
    let refreshes = 0;
    const observed = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const coordinator = yield* makeTreeRefreshCoordinator(() => {
            refreshes += 1;
          }, Duration.millis(1));
          yield* coordinator.requestRefresh(true);
          yield* coordinator.requestRefresh();
          yield* coordinator.requestRefresh();
          yield* coordinator.projectionFinished();
          yield* Effect.promise(() => new Promise(resolve => setTimeout(resolve, 10)));
          return refreshes;
        })
      )
    );

    expect(observed).toBe(2);
  });
});
