/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import * as vscode from 'vscode';

/** Service that publishes VS Code configuration change events */
export class SettingsWatcherService extends Effect.Service<SettingsWatcherService>()('SettingsWatcherService', {
  scoped: Effect.gen(function* () {
    console.log('SettingsWatcherService starting');
    const pubsub = yield* PubSub.sliding<vscode.ConfigurationChangeEvent>(10_000);
    const disposable = vscode.workspace.onDidChangeConfiguration(event => {
      console.log('configuration change event', event);
      Effect.runSync(PubSub.publish(pubsub, event));
    });

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        console.log('disposing configuration change watcher pubsub');
        disposable?.dispose();
      }).pipe(Effect.withSpan('disposing configuration change watcher'))
    );

    console.log('SettingsWatcherService started');
    return { pubsub } as const;
  }),
  dependencies: []
}) {}
