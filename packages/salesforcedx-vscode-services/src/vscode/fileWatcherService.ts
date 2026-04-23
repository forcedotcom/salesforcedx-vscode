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

// #region agent log
/** Batched Extension Host log (Debug Console) — pubsub / file watcher volume; remove when measurement done. */
const pubsubWasteFw = { workspaceFiles: 0, publishOk: 0, publishFail: 0, lastLogMs: 0 };
const pubsubWasteFwLog = (): void => {
  const now = Date.now();
  if (now - pubsubWasteFw.lastLogMs < 5000) {
    return;
  }
  pubsubWasteFw.lastLogMs = now;
  console.log('[sf pubsub]', 'fileWatcher', {
    hypothesisId: 'H-aggregate',
    workspaceFileEventsToPubSub: pubsubWasteFw.workspaceFiles,
    pubSubPublishOk: pubsubWasteFw.publishOk,
    pubSubPublishFail: pubsubWasteFw.publishFail
  });
};
// #endregion

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
          Stream.runForEach(event =>
            Effect.gen(function* () {
              // #region agent log
              pubsubWasteFw.workspaceFiles += 1;
              pubsubWasteFwLog();
              // #endregion
              yield* PubSub.publish(pubsub, event).pipe(
                Effect.tap(() =>
                  Effect.sync(() => {
                    // #region agent log
                    pubsubWasteFw.publishOk += 1;
                    pubsubWasteFwLog();
                    // #endregion
                  })
                ),
                Effect.tapError(() =>
                  Effect.sync(() => {
                    // #region agent log
                    pubsubWasteFw.publishFail += 1;
                    pubsubWasteFwLog();
                    // #endregion
                  })
                ),
                Effect.catchAll(() => Effect.void)
              );
            })
          )
        ),
      watcher => Effect.sync(() => watcher.dispose()).pipe(Effect.withSpan('disposing file watcher'))
    ).pipe(Effect.forkScoped);

    yield* channel.appendToChannel('FileWatcherService started successfully');
  })
);
