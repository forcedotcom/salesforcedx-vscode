/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';

/** Coalesces catalog and discovery refreshes without overlapping tree projections. */
export const makeTreeRefreshCoordinator = (refresh: () => void, quietPeriod: Duration.DurationInput = '500 millis') =>
  Effect.gen(function* () {
    const projectionActive = yield* Ref.make(false);
    const refreshPending = yield* Ref.make(false);
    const refreshScheduled = yield* Ref.make(false);

    const scheduleRefresh = Effect.fn('TreeRefreshCoordinator.scheduleRefresh')(function* () {
      if (yield* Ref.get(projectionActive)) return;
      const scheduled = yield* Ref.modify(refreshScheduled, current => [!current, true]);
      if (!scheduled) return;
      yield* Effect.sleep(quietPeriod);
      yield* Ref.set(refreshScheduled, false);
      if (!(yield* Ref.get(refreshPending)) || (yield* Ref.get(projectionActive))) return;
      yield* Ref.set(refreshPending, false);
      yield* Ref.set(projectionActive, true);
      refresh();
    });

    const requestRefresh = Effect.fn('TreeRefreshCoordinator.requestRefresh')(function* (immediate = false) {
      yield* Ref.set(refreshPending, true);
      if (immediate && !(yield* Ref.get(projectionActive))) {
        yield* Ref.set(refreshPending, false);
        yield* Ref.set(projectionActive, true);
        refresh();
        return;
      }
      yield* Effect.forkDaemon(scheduleRefresh());
    });

    const projectionFinished = Effect.fn('TreeRefreshCoordinator.projectionFinished')(function* () {
      yield* Ref.set(projectionActive, false);
      if (yield* Ref.get(refreshPending)) yield* Effect.forkDaemon(scheduleRefresh());
    });

    const projectionStarted = Effect.fn('TreeRefreshCoordinator.projectionStarted')(function* () {
      yield* Ref.set(projectionActive, true);
    });

    return { requestRefresh, projectionFinished, projectionStarted };
  });
