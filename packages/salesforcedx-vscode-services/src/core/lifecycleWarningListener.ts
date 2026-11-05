/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Lifecycle } from '@salesforce/core/lifecycle';
import { ChannelService } from '@salesforce/vscode-services/v2';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as MutableRef from 'effect/MutableRef';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import { ServiceOperations } from '../services/serviceOperations';

// Core has no public individual unsubscribe. Keep one ordinary native listener per cached module;
// its pointer is cleared at scope close, releasing all captured services. Do not use a unique ID:
// core 9.3.6 copies unique listeners into the ordinary list when another ordinary listener registers.
const warningHandler = MutableRef.make<((warning: string) => Promise<void>) | undefined>(undefined);
const listenerInstalled = MutableRef.make(false);

class LifecycleWarningOwnerError extends Schema.TaggedError<LifecycleWarningOwnerError>()(
  'LifecycleWarningOwnerError',
  {
    message: Schema.String
  }
) {}

/** Own web warning dispatch, without removing other SDK consumers' listeners or retaining a closed services graph. */
const subscribeLifecycleWarnings = Effect.fn('subscribeLifecycleWarnings')(function* () {
  if (process.env.ESBUILD_PLATFORM !== 'web') return;
  const channel = yield* ChannelService;
  const operations = yield* ServiceOperations;
  const context = yield* Effect.context<never>();
  const scope = yield* Effect.acquireRelease(Scope.make(), (value, exit) => Scope.close(value, exit));
  const stopped = MutableRef.make(false);
  const handler = (warning: string) =>
    Effect.runPromiseWith(context)(
      channel.appendToChannel(`[SFDX_CORE WARNING] ${warning}`).pipe(
        Effect.withSpan('LifecycleWarning', { root: true, attributes: { telemetryIgnore: true } }),
        Effect.forkIn(scope),
        Effect.flatMap(Fiber.join),
        Effect.catchCause(
          Effect.fnUntraced(function* (cause) {
            if (Cause.hasInterruptsOnly(cause) && (MutableRef.get(stopped) || (yield* operations.isClosed))) return;
            return yield* Effect.failCause(cause);
          })
        )
      )
    );
  yield* Effect.acquireRelease(
    Effect.suspend(() => {
      if (MutableRef.get(warningHandler))
        return new LifecycleWarningOwnerError({ message: 'Lifecycle warning dispatch already has an active owner' });
      // Check and assignment share this synchronous step; interruption masking alone does not prevent scheduler yields.
      if (!MutableRef.get(listenerInstalled)) {
        Lifecycle.getInstance().onWarning(warning => MutableRef.get(warningHandler)?.(warning) ?? Promise.resolve());
        MutableRef.set(listenerInstalled, true);
      }
      MutableRef.set(warningHandler, handler);
      return Effect.void;
    }),
    () =>
      Effect.sync(() => {
        MutableRef.set(stopped, true);
        if (MutableRef.get(warningHandler) === handler) MutableRef.set(warningHandler, undefined);
      })
  );
});

export const LifecycleWarningsLayer = Layer.effectDiscard(subscribeLifecycleWarnings());
