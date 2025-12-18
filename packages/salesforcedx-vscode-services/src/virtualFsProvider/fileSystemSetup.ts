/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as vscode from 'vscode';
import { sampleProjectName } from '../constants';
import { ChannelService } from '../vscode/channelService';
import { SettingsService } from '../vscode/settingsService';
import { WorkspaceService } from '../vscode/workspaceService';
import { fsPrefix } from './constants';
import { FsProvider } from './fileSystemProvider';
import { IndexedDBStorageService } from './indexedDbStorage';
import { startWatch } from './memfsWatcher';
import { projectFiles } from './projectInit';

/** Wait for workspace folders to be available (async operation after updateWorkspaceFolders) */
const waitForWorkspaceFolders = (): Effect.Effect<readonly vscode.WorkspaceFolder[], Error, never> =>
  Effect.tryPromise({
    try: async () => {
      const folders = vscode.workspace.workspaceFolders;
      return folders && folders.length > 0 ? folders : Promise.reject(new Error('Workspace folders not yet available'));
    },
    catch: () => new Error('Workspace folders not yet available')
  }).pipe(
    Effect.retry({
      schedule: Schedule.fixed(Duration.millis(500)).pipe(Schedule.compose(Schedule.recurs(60))),
      while: error => error instanceof Error && error.message === 'Workspace folders not yet available'
    }),
    Effect.catchAll(() => Effect.fail(new Error('Workspace folders never loaded after 30 seconds')))
  );

/** Sets up the virtual file system for the extension */
export const fileSystemSetup = (
  context: vscode.ExtensionContext
): Effect.Effect<void, Error, WorkspaceService | ChannelService | SettingsService | IndexedDBStorageService> =>
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

    // Wait for workspace folders to be available before returning
    yield* waitForWorkspaceFolders();

    yield* startWatch();
    yield* projectFiles(fsProvider);
  }).pipe(Effect.withSpan('fileSystemSetup'));
