/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as vscode from 'vscode';
import { sampleProjectName } from '../constants';
import { fsPrefix } from './constants';
import { FsProvider } from './fileSystemProvider';
import { IndexedDBStorageService } from './indexedDbStorage';
import { startWatch } from './memfsWatcher';
import { projectFiles } from './projectInit';

class WorkspaceFoldersNotAvailableError extends Data.TaggedError('WorkspaceFoldersNotAvailableError')<{}> {}

/** Wait for workspace folders to be available (async operation after updateWorkspaceFolders) */
const waitForWorkspaceFolders = () =>
  Effect.tryPromise({
    try: async () => {
      const folders = vscode.workspace.workspaceFolders;
      return folders?.length && folders.length > 0 ? folders : Promise.reject(new WorkspaceFoldersNotAvailableError());
    },
    catch: () => new WorkspaceFoldersNotAvailableError()
  }).pipe(
    Effect.retry({
      schedule: Schedule.fixed(Duration.millis(500)).pipe(Schedule.compose(Schedule.recurs(60))),
      while: error => error instanceof WorkspaceFoldersNotAvailableError
    })
  );

/** Sets up the virtual file system for the extension */
export const fileSystemSetup = (context: vscode.ExtensionContext) =>
  Effect.gen(function* () {
    const fsProvider = new FsProvider();

    // Load state from IndexedDB first
    yield* (yield* IndexedDBStorageService).loadState();

    // Register the file system provider
    context.subscriptions.push(
      vscode.workspace.registerFileSystemProvider(fsPrefix, fsProvider, {
        isCaseSensitive: true
      })
    );

    // Replace the existing workspace with ours
    vscode.workspace.updateWorkspaceFolders(0, 0, {
      name: 'Code Builder',
      uri: vscode.Uri.parse(`${fsPrefix}:/${sampleProjectName}`)
    });

    yield* startWatch();
    yield* projectFiles(fsProvider);
    yield* waitForWorkspaceFolders();
  }).pipe(Effect.withSpan('fileSystemSetup'));
