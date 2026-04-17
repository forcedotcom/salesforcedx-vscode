/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { SettingsChangePubSub } from './settingsChangePubSub';

export const SettingsWatcherLayer = Layer.scopedDiscard(
  Effect.gen(function* () {
    const pubsub = yield* SettingsChangePubSub;

    yield* Stream.async<vscode.ConfigurationChangeEvent>(emit => {
      const disposable = vscode.workspace.onDidChangeConfiguration(event => emit.single(event));
      return Effect.sync(() => disposable.dispose()).pipe(Effect.withSpan('disposing configuration change watcher'));
    }).pipe(
      Stream.runForEach(event => PubSub.publish(pubsub, event)),
      Effect.forkScoped
    );
  })
);
