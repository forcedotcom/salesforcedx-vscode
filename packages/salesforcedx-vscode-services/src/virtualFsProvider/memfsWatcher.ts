/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fs } from '@salesforce/core/fs';
import { Effect, Schedule, Stream } from 'effect';
// eslint-disable-next-line no-restricted-imports
import type { FileChangeInfo } from 'node:fs/promises';
import * as vscode from 'vscode';
import { sampleProjectName } from '../constants';
import { SdkLayer } from '../observability/spans';
import { ChannelService } from '../vscode/channelService';
import { fsPrefix } from './constants';
import { IndexedDBStorageService } from './indexedDbStorage';

// we need an emitter to send events to the fileSystemProvider using the vscode API
export const emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
/** Starts watching the memfs for file changes */
export const startWatch = (): Effect.Effect<void, Error, ChannelService | IndexedDBStorageService> =>
  Effect.gen(function* () {
    const channelService = yield* ChannelService;

    yield* channelService.appendToChannel(`Starting file watcher for /${sampleProjectName}`);

    const projectPath = `/${sampleProjectName}`;
    // Ensure the directory exists before watching
    fs.mkdirSync(projectPath, { recursive: true });

    // Create and run the stream that watches for file changes
    yield* Stream.fromAsyncIterable(
      // this watches files in the project/workspace only, not the global sfdx folders, tmp, home, etc.
      fs.promises.watch(projectPath, { recursive: true }),
      e => new Error(String(e)) // Error Handling
    ).pipe(
      // if there are "change" events AND non-change events for the same file, drop the change events.  We prefer the "rename" (create) event.
      Stream.changesWith((a, b) => a.eventType === 'change' && b.eventType !== 'change' && a.filename === b.filename),
      Stream.changesWith((a, b) => b.eventType === 'change' && a.eventType !== 'change' && a.filename === b.filename),
      Stream.schedule(Schedule.spaced(1)), // prevent the IDB writes from happening simultaneously.  That causes hangs
      Stream.mapEffect(updateIDB),
      Stream.runDrain,
      Effect.forkDaemon // Run in a daemon fiber that won't block
    );

    yield* channelService.appendToChannel('File watcher started successfully');
  }).pipe(
    Effect.tapError((error: Error) =>
      Effect.flatMap(ChannelService, channel => channel.appendToChannel(`Error starting watcher: ${error.message}`))
    ),
    Effect.withSpan('startWatch'),
    Effect.provide(SdkLayer)
  );

const updateIDB = (event: FileChangeInfo<string>): Effect.Effect<void, Error, IndexedDBStorageService> =>
  Effect.gen(function* () {
    if (!event.filename) {
      return;
    }
    const fullPath = `/${sampleProjectName}/${event.filename}`;
    const uri = vscode.Uri.parse(`${fsPrefix}:/${sampleProjectName}/${event.filename}`);

    const storage = yield* IndexedDBStorageService;
    if (event.eventType === 'rename') {
      if (fs.existsSync(fullPath)) {
        yield* storage.saveFile(fullPath);
        emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
      } else {
        yield* storage.deleteFile(fullPath);
        emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
      }
    } else if (event.eventType === 'change') {
      yield* storage.saveFile(fullPath);
      emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    }
  }).pipe(Effect.withSpan('updateIDB', { attributes: { filename: event.filename, eventType: event.eventType } }));
