/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fs } from '@salesforce/core/fs';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
// eslint-disable-next-line no-restricted-imports
import type { FileChangeInfo } from 'node:fs/promises';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { sampleProjectName } from '../constants';
import { ChannelService } from '../vscode/channelService';
import { fsPrefix } from './constants';
import { IndexedDBStorageService } from './indexedDbStorage';

// we need an emitter to send events to the fileSystemProvider using the vscode API
export const emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();

const updateIDB = (storage: IndexedDBStorageService) =>
  Effect.fn('updateIDB')(function* (event: FileChangeInfo<string>) {
    if (!event.filename) {
      return;
    }

    const fullPath = `/${sampleProjectName}/${event.filename}`;
    const uri = URI.parse(`${fsPrefix}:/${sampleProjectName}/${event.filename}`);

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
  });

/** Starts watching the memfs for file changes */
export const startWatch = Effect.fn('startWatch')(
  function* () {
    const channelService = yield* ChannelService;
    const updater = updateIDB(yield* IndexedDBStorageService);

    yield* channelService.appendToChannel(`Starting file watcher for /${sampleProjectName}`);

    const projectPath = `/${sampleProjectName}`;
    // Ensure the directory exists before watching
    fs.mkdirSync(projectPath, { recursive: true });

    // this watches files in the project/workspace only, not the global sfdx folders, tmp, home, etc.
    yield* Stream.fromAsyncIterable(
      fs.promises.watch(projectPath, { recursive: true }),
      e => new Error(String(e))
    ).pipe(
      // if there are "change" events AND non-change events for the same file, drop the change events.  We prefer the "rename" (create) event.
      Stream.changesWith((a, b) => a.eventType === 'change' && b.eventType !== 'change' && a.filename === b.filename),
      Stream.changesWith((a, b) => b.eventType === 'change' && a.eventType !== 'change' && a.filename === b.filename),
      Stream.throttle({
        cost: Chunk.size,
        duration: '10 millis',
        units: 1
      }),
      Stream.mapEffect(updater),
      Stream.runDrain,
      Effect.forkScoped // Run in a daemon fiber that won't block
    );

    yield* channelService.appendToChannel('File watcher started successfully');
  },
  Effect.tapError((error: Error) =>
    Effect.flatMap(ChannelService, channel => channel.appendToChannel(`Error starting watcher: ${error.message}`))
  )
);
