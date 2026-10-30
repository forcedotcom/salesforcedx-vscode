/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChannelService, FileChangePubSub, type FileChangeEvent } from '@salesforce/vscode-services-v2';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as Queue from 'effect/Queue';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';

/** Channel is an explicit V4 requirement; its implementation remains assigned to W-24615069. */
export const FileWatcherLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const events = yield* FileChangePubSub;
    const channel = yield* ChannelService;
    const watcher = yield* Effect.acquireRelease(
      Effect.sync(() => vscode.workspace.createFileSystemWatcher('**/*')),
      value =>
        Effect.sync(() => {
          value.dispose();
        }).pipe(Effect.withSpan('disposing file watcher'))
    );
    const subscribed = yield* Deferred.make<void>();
    yield* Stream.callback<FileChangeEvent>(queue =>
      Effect.forEach(
        [
          () =>
            watcher.onDidCreate(uri => {
              Queue.offerUnsafe(queue, { type: 'create', uri });
            }),
          () =>
            watcher.onDidChange(uri => {
              Queue.offerUnsafe(queue, { type: 'change', uri });
            }),
          () =>
            watcher.onDidDelete(uri => {
              Queue.offerUnsafe(queue, { type: 'delete', uri });
            })
        ],
        register =>
          Effect.acquireRelease(Effect.sync(register), listener =>
            Effect.sync(() => {
              listener.dispose();
            })
          ),
        { concurrency: 1, discard: true }
      ).pipe(Effect.onExit(exit => Deferred.done(subscribed, exit)))
    ).pipe(
      Stream.runForEach(event => PubSub.publish(events, event)),
      Effect.forkScoped
    );
    yield* Deferred.await(subscribed);
    yield* channel.appendToChannel('FileWatcherService started successfully');
  })
);
