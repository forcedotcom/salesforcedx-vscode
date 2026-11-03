/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fs } from '@salesforce/core/fs';
import { ChannelService } from '@salesforce/vscode-services/v2';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
// eslint-disable-next-line no-restricted-imports
import type { FileChangeInfo } from 'node:fs/promises';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { makeScopedFibers } from '../services/scopedFiber';
import { IndexedDBStorageService } from './indexedDbStorage';
import { getProjectRoot } from './projectRoot';
import { VirtualFsProviderError } from './virtualFsProviderError';

// we need an emitter to send events to the fileSystemProvider using the vscode API
export const emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();

export const updateIDB = Effect.fn('updateIDB')(
  function* (event: FileChangeInfo<string>) {
    if (!event.filename) {
      return;
    }

    // Catalog writes use this staging file for an atomic rename; it is not a workspace file.
    if (Utils.basename(URI.file(event.filename)) === 'catalog.json.__staging__') {
      return;
    }

    const storage = yield* IndexedDBStorageService;
    const { fsPath, uri: rootUri } = yield* getProjectRoot();
    const fullPath = `${fsPath}/${event.filename}`;
    const uri = URI.parse(`${rootUri}/${event.filename}`);
    yield* Effect.annotateCurrentSpan({ filename: event.filename, eventType: event.eventType, path: fullPath });

    if (event.eventType !== 'rename' && event.eventType !== 'change') {
      return;
    }

    const exists = fs.existsSync(fullPath);
    const createdOrChanged =
      event.eventType === 'rename' ? vscode.FileChangeType.Created : vscode.FileChangeType.Changed;
    emitter.fire([{ type: exists ? createdOrChanged : vscode.FileChangeType.Deleted, uri }]);
    return exists ? yield* storage.saveFile(fullPath) : yield* storage.deleteFile(fullPath);
  },
  Effect.catchTag('VirtualFsProviderError', error =>
    Effect.logWarning('updateIDB failed').pipe(
      Effect.annotateLogs({ message: error.message }),
      Effect.andThen(
        Effect.flatMap(ChannelService, channel => channel.appendToChannel(`IndexedDB persist failed: ${error.message}`))
      )
    )
  )
);

/** Starts watching the memfs for file changes */
export const startWatch = Effect.fn('startWatch')(
  function* () {
    const channelService = yield* ChannelService;
    const projectPath = (yield* getProjectRoot()).fsPath;
    yield* channelService.appendToChannel(`Starting file watcher for ${projectPath}`);
    // Ensure the directory exists before watching
    fs.mkdirSync(projectPath, { recursive: true });

    const watcher = yield* Effect.acquireRelease(
      Effect.sync(() => {
        const controller = new AbortController();
        return { controller, events: fs.promises.watch(projectPath, { recursive: true, signal: controller.signal }) };
      }),
      value =>
        Effect.sync(() => {
          value.controller.abort();
        })
    );
    // Join the consuming fiber before aborting the native iterator; shutdown is not a persistence failure.
    const fibers = yield* makeScopedFibers;

    // this watches files in the project/workspace only, not the global sfdx folders, tmp, home, etc.
    yield* Stream.fromAsyncIterable(watcher.events, e => new VirtualFsProviderError({ message: String(e) })).pipe(
      // if there are "change" events AND non-change events for the same file, drop the change events.  We prefer the "rename" (create) event.
      Stream.changesWith((a, b) => a.eventType === 'change' && b.eventType !== 'change' && a.filename === b.filename),
      Stream.changesWith((a, b) => b.eventType === 'change' && a.eventType !== 'change' && a.filename === b.filename),
      Stream.throttle({
        cost: batch => batch.length,
        duration: Duration.millis(10),
        units: 1
      }),
      Stream.mapEffect(updateIDB),
      Stream.runDrain,
      fibers.fork
    );

    yield* channelService.appendToChannel('File watcher started successfully');
  },
  Effect.tapError((error: VirtualFsProviderError) =>
    Effect.flatMap(ChannelService, channel => channel.appendToChannel(`Error starting watcher: ${error.message}`))
  )
);
