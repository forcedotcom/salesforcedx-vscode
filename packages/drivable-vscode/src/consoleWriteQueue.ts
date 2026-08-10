/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DrivableVscodeArtifactError } from './errors';
import type { DrivableVscodeRendererConsoleEntry } from './schemas';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Match from 'effect/Match';
import * as Queue from 'effect/Queue';

export type ConsoleWrite =
  | { readonly _tag: 'Entry'; readonly entry: DrivableVscodeRendererConsoleEntry }
  | { readonly _tag: 'Stop' };

export const consumeConsoleWrites = (
  queue: Queue.Dequeue<ConsoleWrite>,
  persist: (entry: DrivableVscodeRendererConsoleEntry) => Effect.Effect<void, DrivableVscodeArtifactError>
  // eslint-disable-next-line local/no-explicit-effect-return-type -- Recursive implementation requires an annotation.
): Effect.Effect<void, DrivableVscodeArtifactError> =>
  queue.pipe(
    Queue.take,
    Effect.flatMap(item =>
      Match.value(item).pipe(
        Match.when({ _tag: 'Entry' }, ({ entry }) =>
          persist(entry).pipe(Effect.zipRight(Effect.suspend(() => consumeConsoleWrites(queue, persist))))
        ),
        Match.when({ _tag: 'Stop' }, () => Effect.void),
        Match.exhaustive
      )
    )
  );

export const drainConsoleWrites = (
  queue: Queue.Queue<ConsoleWrite>,
  consumer: Fiber.Fiber<void, DrivableVscodeArtifactError>
) =>
  Effect.uninterruptible(
    Queue.offer(queue, { _tag: 'Stop' }).pipe(
      Effect.zipRight(Fiber.join(consumer)),
      Effect.ensuring(Queue.shutdown(queue))
    )
  );
