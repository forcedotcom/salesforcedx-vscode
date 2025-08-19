/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fs } from '@salesforce/core/fs';
import { Effect, Layer, pipe } from 'effect';
import * as vscode from 'vscode';
import { sampleProjectName } from '../constants';
import { WebSdkLayer } from '../observability/spans';
import { ChannelService, ChannelServiceLayer } from '../vscode/channelService';
import { fsPrefix } from './constants';
import { IndexedDBStorageService, IndexedDBStorageServiceShared } from './indexedDbStorage';

/* eslint-disable functional/no-try-statements */

const storageWithChannel = Layer.provideMerge(
  IndexedDBStorageServiceShared,
  ChannelServiceLayer('Salesforce Services')
);

// we need an emitter to send events to the fileSystemProvider using the vscode API
export const emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
/** Starts watching the memfs for file changes */
export const startWatch = (): Effect.Effect<void, Error, ChannelService> =>
  Effect.gen(function* () {
    const channelService = yield* ChannelService;

    yield* channelService.appendToChannel(`Starting file watcher for /${sampleProjectName}`);

    // Wrap fs.watch in an Effect
    yield* Effect.async<void, Error>(resume => {
      try {
        const projectPath = `/${sampleProjectName}`;

        // Ensure the directory exists before watching
        fs.mkdirSync(projectPath, { recursive: true });

        // this watches files in the project/workspace only, not the global sfdx folders, tmp, home, etc.
        fs.watch(projectPath, { recursive: true }, async (event: string, filename: string) => {
          const fullPath = `/${sampleProjectName}/${filename}`;
          try {
            const uri = vscode.Uri.parse(`${fsPrefix}:/${sampleProjectName}/${filename}`);

            // For 'rename' events, we need to check if the file exists
            // If it exists, it was created/renamed to. If not, it was deleted/renamed from
            if (event === 'rename') {
              if (fs.existsSync(fullPath)) {
                // File was created or renamed to this location
                const program = pipe(
                  IndexedDBStorageService,
                  Effect.flatMap(storage => storage.saveFile(fullPath)),
                  Effect.provide(storageWithChannel),
                  Effect.withSpan('watchProject:rename(saveFile)', { attributes: { path: fullPath, uri } }),
                  Effect.provide(WebSdkLayer)
                );
                await Effect.runPromise(Effect.scoped(program));
                emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
              } else {
                // File was deleted or renamed from this location
                const program = pipe(
                  IndexedDBStorageService,
                  Effect.flatMap(storage => storage.deleteFile(fullPath)),
                  Effect.provide(storageWithChannel),
                  Effect.withSpan('watchProject:rename(deleteFile)', { attributes: { path: fullPath, uri } }),
                  Effect.provide(WebSdkLayer)
                );
                await Effect.runPromise(Effect.scoped(program));
                emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
              }
            }
            // For 'change' events, always save to IndexedDB
            else if (event === 'change') {
              const program = pipe(
                IndexedDBStorageService,
                Effect.flatMap(storage => storage.saveFile(fullPath)),
                Effect.provide(storageWithChannel),
                Effect.withSpan('watchProject:change(saveFile)', { attributes: { path: fullPath, uri } }),
                Effect.provide(WebSdkLayer)
              );
              await Effect.runPromise(Effect.scoped(program));
              emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
            }
          } catch (error) {
            // Get channel service for error logging
            const channel = await Effect.runPromise(
              pipe(ChannelService, Effect.provide(ChannelServiceLayer('Salesforce Services')))
            );
            await Effect.runPromise(
              channel.appendToChannel(`Error handling fs event for ${fullPath}: ${String(error)}`)
            );
          }
        });

        resume(Effect.succeed(undefined));
      } catch (error) {
        resume(Effect.fail(new Error(`Failed to start file watcher: ${String(error)}`)));
      }
    });

    yield* channelService.appendToChannel('File watcher started successfully');
  }).pipe(
    Effect.tapError(error =>
      Effect.flatMap(ChannelService, channel => channel.appendToChannel(`Error starting watcher: ${error.message}`))
    ),
    Effect.withSpan('startWatch'),
    Effect.provide(WebSdkLayer)
  );
