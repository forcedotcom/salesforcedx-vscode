/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import type * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';

/** Private provider state; presence/enabled changes are distinct from extension activation. */
export class ExtensionsService extends Context.Service<
  ExtensionsService,
  {
    readonly changes: Stream.Stream<ReadonlySet<string>>;
    readonly get: Effect.Effect<ReadonlySet<string>>;
    readonly isInstalled: (id: string) => Effect.Effect<boolean>;
  }
>()('@salesforce/vscode-services/internal/ExtensionsService') {}

const snapshot = (): ReadonlySet<string> => new Set(vscode.extensions.all.map(extension => extension.id));
export const ExtensionsServiceLayer = Layer.effect(
  ExtensionsService,
  Effect.gen(function* () {
    const operations = yield* ServiceOperations;
    const context = yield* Effect.context<never>();
    const ref = yield* Effect.acquireRelease(SubscriptionRef.make(snapshot()), value => PubSub.shutdown(value.pubsub));
    yield* Effect.acquireRelease(
      Effect.sync(() =>
        vscode.extensions.onDidChange(() => {
          if (PubSub.isShutdownUnsafe(ref.pubsub)) return;
          // Native callbacks publish before returning, as in the V3 service; no detached runner/fiber.
          Effect.runSyncWith(context)(SubscriptionRef.set(ref, snapshot()));
        })
      ),
      listener =>
        Effect.sync(() => {
          listener.dispose();
        })
    );
    // Capture changes that happened synchronously while the listener was being installed.
    yield* SubscriptionRef.set(ref, snapshot());
    yield* Effect.addFinalizer(() => operations.close);
    return ExtensionsService.of({
      changes: SubscriptionRef.changes(ref),
      get: operations.run(SubscriptionRef.get(ref)),
      isInstalled: Effect.fn('ExtensionsService.isInstalled')(
        (id: string) => SubscriptionRef.get(ref).pipe(Effect.map(ids => ids.has(id))),
        operations.run
      )
    });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
