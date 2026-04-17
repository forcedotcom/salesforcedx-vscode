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
import { ChannelService } from './channelService';
import { FileChangePubSub, type FileChangeEvent } from './fileChangePubSub';

export const FileWatcherLayer = Layer.scopedDiscard(
  Effect.gen(function* () {
    const pubsub = yield* FileChangePubSub;
    const channel = yield* ChannelService;

    yield* Effect.acquireUseRelease(
      Effect.sync(() => vscode.workspace.createFileSystemWatcher('**/*')),
      watcher =>
        Stream.async<FileChangeEvent>(emit => {
          watcher.onDidCreate(uri => emit.single({ type: 'create', uri }));
          watcher.onDidChange(uri => emit.single({ type: 'change', uri }));
          watcher.onDidDelete(uri => emit.single({ type: 'delete', uri }));
        }).pipe(
          Stream.runForEach(event => PubSub.publish(pubsub, event).pipe(Effect.catchAll(() => Effect.void)))
        ),
      watcher => Effect.sync(() => watcher.dispose()).pipe(Effect.withSpan('disposing file watcher'))
    ).pipe(Effect.forkScoped);

    yield* channel.appendToChannel('FileWatcherService started successfully');
  })
);
