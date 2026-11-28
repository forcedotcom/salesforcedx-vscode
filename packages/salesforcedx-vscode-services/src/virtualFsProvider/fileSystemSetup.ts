/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataRegistryService, SettingsService } from '@salesforce/vscode-services/v2';
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as MutableRef from 'effect/MutableRef';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { CODE_BUILDER_WEB_SECTION, sampleProjectName } from '../constants';
import { WebFileSystemProvider } from '../services/webFileSystemProvider';
import { fsPrefix } from './constants';
import { FsProvider } from './fileSystemProvider';
import { fsProviderRef } from './fsProviderRef';
import { IndexedDBStorageService } from './indexedDbStorage';
import { startWatch } from './memfsWatcher';
import { projectFiles } from './projectInit';

class WorkspaceFoldersNotAvailableError extends Schema.TaggedError<WorkspaceFoldersNotAvailableError>()(
  'WorkspaceFoldersNotAvailableError',
  {
    message: Schema.String
  }
) {}

/** Host mutations wait for bootstrap; initialization itself uses this same underlying provider directly. */
const gateHostMutations = (provider: FsProvider, protectionReady: Deferred.Deferred<boolean>) => {
  const disposed = MutableRef.make(false);
  const mutate = async <A>(run: () => PromiseLike<A>) => {
    const ready = await protectionReady.pipe(Deferred.await, Effect.runPromise);
    return ready && !MutableRef.get(disposed)
      ? run()
      : Promise.reject(vscode.FileSystemError.Unavailable('Filesystem initialization failed or closed'));
  };
  const mutations = {
    writeFile: (...args: Parameters<FsProvider['writeFile']>) => mutate(() => provider.writeFile(...args)),
    createDirectory: (...args: Parameters<FsProvider['createDirectory']>) =>
      mutate(() => provider.createDirectory(...args)),
    delete: (...args: Parameters<FsProvider['delete']>) => mutate(() => provider.delete(...args)),
    rename: (...args: Parameters<FsProvider['rename']>) => mutate(() => provider.rename(...args))
  };
  return {
    close: () => MutableRef.set(disposed, true),
    provider: new Proxy(provider, {
      get: (target, property, receiver) => {
        const value: unknown =
          typeof property === 'string' && Object.hasOwn(mutations, property)
            ? Reflect.get(mutations, property)
            : Reflect.get(target, property, receiver);
        return value;
      }
    })
  };
};

/** Wait for workspace folders to be available (async operation after updateWorkspaceFolders) */
const waitForWorkspaceFolders = () =>
  Effect.suspend(() => {
    const folders = vscode.workspace.workspaceFolders;
    return folders?.length
      ? Effect.succeed(folders)
      : new WorkspaceFoldersNotAvailableError({ message: 'Workspace folders are not yet available' });
  }).pipe(
    Effect.retry({
      schedule: Schedule.fixed(Duration.millis(500)),
      times: 60
    })
  );

/** Sets up the virtual file system for the extension */
export const fileSystemSetup = Effect.fn('fileSystemSetup')(function* () {
  const registry = yield* MetadataRegistryService;
  const protectionReady = yield* Deferred.make<boolean>();

  // Load state from IndexedDB first
  yield* (yield* IndexedDBStorageService).loadState();

  // Register the file system provider
  const fsProvider = yield* Effect.acquireRelease(
    Effect.sync(() => {
      const provider = new FsProvider();
      const host = gateHostMutations(provider, protectionReady);
      const hostProvider = host.provider;
      const registration = vscode.workspace.registerFileSystemProvider(fsPrefix, hostProvider, {
        isCaseSensitive: true
      });
      fsProviderRef.current = hostProvider;
      return { provider, hostProvider, registration, close: host.close };
    }),
    ({ hostProvider, registration, close }) =>
      Effect.sync(() => {
        close();
        if (fsProviderRef.current === hostProvider) fsProviderRef.current = undefined;
        registration.dispose();
      }).pipe(Effect.ensuring(Deferred.succeed(protectionReady, false)))
  );

  // Only inject the memfs sample project when the user hasn't already opened a workspace folder.
  // If a folder is already open (e.g. the Code Builder Web host booting `memfs:/<sampleProjectName>`
  // via its workspaceProvider, a real project loaded via `?folder=` in web, a `--folder` arg, or a
  // Playwright-E2E vscode-test-web mount), prepending a synthetic sample would hide that folder's
  // Explorer contents behind the memfs tree and break file lookups/search.
  // No `name` override: the Explorer root derives from the folder URI basename, so standalone and
  // host-opened windows both show `sampleProjectName`.
  const hasExistingWorkspace = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
  if (!hasExistingWorkspace) {
    vscode.workspace.updateWorkspaceFolders(0, 0, {
      uri: URI.parse(`${fsPrefix}:/${sampleProjectName}`)
    });
  }

  yield* startWatch();
  yield* projectFiles(fsProvider.provider);
  if (!hasExistingWorkspace) {
    yield* waitForWorkspaceFolders();
  }

  const settingsService = yield* SettingsService;

  if (yield* settingsService.getValueOrElse(CODE_BUILDER_WEB_SECTION, 'protectedOrg', false)) {
    yield* Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:protectedOrg', true));
    const registryAccess = yield* registry.getRegistryAccess();
    // protected org: make apex read only
    fsProvider.provider.readOnly = {
      registry: registryAccess,
      types: [registryAccess.getTypeByName('ApexClass'), registryAccess.getTypeByName('ApexTrigger')]
    };
  }
  yield* Deferred.succeed(protectionReady, true);
  return fsProvider.hostProvider;
});

/** Activation owns the registered provider in the same memo map used by the domain runtime. */
export const WebFileSystemProviderLayer = Layer.effect(
  WebFileSystemProvider,
  fileSystemSetup().pipe(Effect.map(provider => ({ get: () => provider })))
);
