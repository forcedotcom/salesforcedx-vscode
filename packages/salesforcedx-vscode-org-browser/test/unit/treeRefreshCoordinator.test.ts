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
    const coordinator = await Effect.runPromise(
      makeTreeRefreshCoordinator(() => {
        refreshes += 1;
      }, Duration.millis(1))
    );

    await Effect.runPromise(coordinator.requestRefresh(true));
    await Effect.runPromise(coordinator.requestRefresh());
    await Effect.runPromise(coordinator.requestRefresh());
    await Effect.runPromise(coordinator.projectionFinished());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(refreshes).toBe(2);
  });
});
