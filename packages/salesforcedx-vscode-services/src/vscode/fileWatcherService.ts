/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import * as vscode from 'vscode';
import { ChannelService } from './channelService';

export type FileChangeEvent = {
  readonly type: 'create' | 'change' | 'delete';
  readonly uri: vscode.Uri;
};

/** Centralized workspace file watcher service that broadcasts all file changes via PubSub */
export class FileWatcherService extends Effect.Service<FileWatcherService>()('FileWatcherService', {
  scoped: Effect.gen(function* () {
    const pubsub = yield* PubSub.sliding<FileChangeEvent>(10_000);
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');

    watcher.onDidCreate(uri =>
      Effect.runSync(PubSub.publish(pubsub, { type: 'create' as const, uri }).pipe(Effect.catchAll(() => Effect.void)))
    );

    watcher.onDidChange(uri =>
      Effect.runSync(PubSub.publish(pubsub, { type: 'change' as const, uri }).pipe(Effect.catchAll(() => Effect.void)))
    );

    watcher.onDidDelete(uri =>
      Effect.runSync(PubSub.publish(pubsub, { type: 'delete' as const, uri }).pipe(Effect.catchAll(() => Effect.void)))
    );

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        watcher.dispose();
      }).pipe(Effect.withSpan('disposing file watcher'))
    );

    yield* (yield* ChannelService).appendToChannel('FileWatcherService started successfully');

    return { pubsub } as const;
  }),
  dependencies: [ChannelService.Default]
}) {}
