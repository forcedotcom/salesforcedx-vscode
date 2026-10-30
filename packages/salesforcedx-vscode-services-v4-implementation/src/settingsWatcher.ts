/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SettingsChangePubSub } from '@salesforce/vscode-services-v2';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as Queue from 'effect/Queue';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';

/** Registers once per layer scope and waits for registration before publishing acquisition success. */
export const SettingsWatcherLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const events = yield* SettingsChangePubSub;
    const subscribed = yield* Deferred.make<void>();
    yield* Stream.callback<vscode.ConfigurationChangeEvent>(queue =>
      Effect.acquireRelease(
        Effect.sync(() =>
          vscode.workspace.onDidChangeConfiguration(event => {
            Queue.offerUnsafe(queue, event);
          })
        ),
        disposable =>
          Effect.sync(() => {
            disposable.dispose();
          }).pipe(Effect.withSpan('disposing configuration change watcher'))
      ).pipe(
        Effect.asVoid,
        Effect.onExit(exit => Deferred.done(subscribed, exit))
      )
    ).pipe(
      Stream.runForEach(event => PubSub.publish(events, event)),
      Effect.forkScoped
    );
    yield* Deferred.await(subscribed);
  })
);
