/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { CompatibilityHost, HostExit } from './compatibilityHost.js';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { identity } from 'effect/Function';
import { createLegacyServices, fromHostExit } from './createLegacyServices.js';

const finish = (exit: HostExit<void, never>) => fromHostExit(exit, identity<never>);

/** V3-only lifecycle glue: no V4 declaration or runnable value enters this compiler program. */
export const createCompatibleConnectionServices = async <V2>(
  createOwner: (signal?: AbortSignal) => Promise<{
    readonly v2: V2;
    readonly host: CompatibilityHost;
    readonly close: () => Promise<HostExit<void, never>>;
    readonly dispose: () => Promise<HostExit<void, never>>;
  }>,
  signal?: AbortSignal
) => {
  const owner = await createOwner(signal);
  const bridge = await createLegacyServices(owner.host, signal).catch(async error => {
    const cleanup = await owner.dispose();
    if (cleanup._tag === 'Failure')
      throw new AggregateError([error, cleanup.reasons], 'Compatibility startup and runtime cleanup failed');
    throw error;
  });
  const dispose = Effect.promise(owner.close).pipe(
    Effect.flatMap(finish),
    Effect.ensuring(
      Effect.promise(bridge.dispose).pipe(Effect.ensuring(Effect.promise(owner.dispose).pipe(Effect.flatMap(finish))))
    ),
    Effect.exit,
    Effect.cached,
    Effect.runSync
  );
  return {
    services: bridge.services,
    v2: owner.v2,
    dispose: () =>
      Effect.runPromise(dispose).then(exit => {
        if (Exit.isFailure(exit)) return exit.cause.pipe(Effect.failCause, Effect.runPromise);
      })
  };
};
