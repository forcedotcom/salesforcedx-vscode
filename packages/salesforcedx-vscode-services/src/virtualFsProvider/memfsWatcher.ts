/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fs } from '@salesforce/core';
import { Effect, Layer, pipe } from 'effect';
import * as vscode from 'vscode';
import { sampleProjectName } from '../constants';
import { ChannelService, ChannelServiceLayer } from '../vscode/channelService';
import { fsPrefix } from './constants';
import { IndexedDBStorageService, IndexedDBStorageServiceLive } from './indexedDbStorage';

/* eslint-disable functional/no-try-statements */

const storageWithChannel = Layer.provideMerge(IndexedDBStorageServiceLive, ChannelServiceLayer('Salesforce Services'));

// we need an emitter to send events to the fileSystemProvider using the vscode API
export const emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
export const startWatch = async (): Promise<void> => {
  // this watches files in the project/workspace only, not the global sfdx folders, tmp, home, etc.
  fs.watch(`/${sampleProjectName}`, { recursive: true }, async (event: string, filename: string) => {
    try {
      const uri = vscode.Uri.parse(`${fsPrefix}:/${sampleProjectName}/${filename}`);

      // For 'rename' events, we need to check if the file exists
      // If it exists, it was created/renamed to. If not, it was deleted/renamed from
      if (event === 'rename') {
        if (fs.existsSync(filename)) {
          // File was created or renamed to this location
          const program = pipe(
            IndexedDBStorageService,
            Effect.flatMap(storage => storage.saveFile(filename)),
            Effect.flatMap(() => ChannelService),
            Effect.flatMap(channel =>
              Effect.sync(() => channel.appendToChannel(`Saved new/renamed file ${filename} to IndexedDB`))
            ),
            Effect.provide(storageWithChannel)
          );
          await Effect.runPromise(program);
          emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
        } else {
          // File was deleted or renamed from this location
          const program = pipe(
            IndexedDBStorageService,
            Effect.flatMap(storage => storage.deleteFile(filename)),
            Effect.flatMap(() => ChannelService),
            Effect.flatMap(channel =>
              Effect.sync(() => channel.appendToChannel(`Deleted file ${filename} from IndexedDB`))
            ),
            Effect.provide(storageWithChannel)
          );
          await Effect.runPromise(program);
          emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
        }
      }
      // For 'change' events, always save to IndexedDB
      else if (event === 'change') {
        const program = pipe(
          IndexedDBStorageService,
          Effect.flatMap(storage => storage.saveFile(filename)),
          Effect.flatMap(() => ChannelService),
          Effect.flatMap(channel =>
            Effect.sync(() => channel.appendToChannel(`Saved changed file ${filename} to IndexedDB`))
          ),
          Effect.provide(storageWithChannel)
        );
        await Effect.runPromise(program);
        emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
      }
    } catch (error) {
      // Get channel service for error logging
      const channel = await Effect.runPromise(
        pipe(ChannelService, Effect.provide(ChannelServiceLayer('Salesforce Services')))
      );
      channel.appendToChannel(`Error handling fs event for ${filename}: ${error}`);
    }
  });
};
