/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { buildAllServicesLayer, ExtensionProviderService } from '@salesforce/effect-ext-utils';
import {
  isLWC,
  LWC_SERVER_READY_NOTIFICATION,
  type WorkspaceType
} from '@salesforce/salesforcedx-lightning-lsp-common';
import { detectWorkspaceType } from '@salesforce/salesforcedx-lightning-lsp-common/detectWorkspaceTypeVscode';
import { registerWorkspaceReadFileHandler } from '@salesforce/salesforcedx-lightning-lsp-common/workspaceReadFileHandler';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isError } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { ExtensionContext, workspace } from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { URI, Utils } from 'vscode-uri';
import { channelAdapter } from './channel';
import { createLwcCommand } from './commands/createLwc';
import { renameLwcCommand } from './commands/renameLwc';
import { log } from './constants';
import { createLanguageClient } from './languageClient';
import LwcLspStatusBarItem from './lwcLspStatusBarItem';
import { nls } from './messages';
import { activateMetaSupport } from './metasupport/metaSupport';
import { setAllServicesLayer } from './services/extensionProvider';
import { getRuntime } from './services/runtime';
import { telemetryService } from './telemetry';
import { startLwcFileWatcher } from './util/lwcFileWatcher';

class LwcLanguageServerError extends Schema.TaggedError<LwcLanguageServerError>()('LwcLanguageServerError', {
  message: Schema.String
}) {}

// Module-level state to allow the sfdx-project.json watcher to restart the client
let languageClient: BaseLanguageClient | undefined;
let extensionUri: URI;
let initializationOptions: { workspaceType: WorkspaceType; sfdxTypingsDir: string };

export const activate = async (extensionContext: ExtensionContext) => {
  // Initialize services layer first so ChannelService and other services are available throughout activation.
  setAllServicesLayer(buildAllServicesLayer(extensionContext, nls.localize('channel_name')));
  await getRuntime().runPromise(activateEffect(extensionContext));
};

export const activateEffect = Effect.fn('activation:salesforcedx-vscode-lwc')(function* (
  extensionContext: ExtensionContext
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelSvc = yield* api.services.ChannelService;

  yield* channelSvc.appendToChannel(nls.localize('lwc_extension_activating'));

  // Run our auto detection routine before we activate
  // If activationMode is off, don't startup no matter what
  if (getActivationMode() === 'off') {
    yield* channelSvc.appendToChannel(nls.localize('lwc_activation_mode_off'));
    return;
  }

  // if we have no workspace folders, exit
  if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
    yield* channelSvc.appendToChannel(nls.localize('lwc_no_workspace_folders'));
    return;
  }

  // Pass the workspace folder URIs to the language server

  // Path-based detection (Node fs paths) can return UNKNOWN for virtual workspaces; confirm via ProjectService.
  const detected = yield* detectWorkspaceType(
    // In web mode, fsPath might be undefined for non-file:// URIs
    workspace.workspaceFolders.map(folder => folder.uri.fsPath ?? folder.uri.path).filter(Boolean)
  );
  const isSalesforceProject =
    detected === 'UNKNOWN'
      ? yield* api.services.ProjectService.isSalesforceProject().pipe(Effect.orElseSucceed(() => false))
      : false;
  const workspaceType: WorkspaceType = detected !== 'UNKNOWN' ? detected : isSalesforceProject ? 'SFDX' : detected;

  // Check if we have a valid project structure
  if (getActivationMode() === 'autodetect' && !isLWC(workspaceType)) {
    // If activationMode === autodetect and we don't have a valid workspace type, exit
    yield* channelSvc.appendToChannel(nls.localize('lwc_autodetect_no_project', workspaceType));
    return;
  }

  // Start the LWC Language Server
  const sfdxTypingsDir = Utils.joinPath(
    URI.from(extensionContext.extensionUri),
    'resources',
    'sfdx',
    'typings'
  ).toString();

  // Get package directories from sfdx-project.json to scope file watchers (performance optimization)
  const packageDirectories: string[] | undefined = yield* api.services.ProjectService.getSfProject().pipe(
    Effect.map(project => project.getPackageDirectories().map(dir => dir.path)),
    Effect.orElseSucceed(() => undefined)
  );

  // Store initialization options for restart
  extensionUri = extensionContext.extensionUri;
  initializationOptions = { workspaceType, sfdxTypingsDir };

  const client = yield* Effect.tryPromise({
    try: () => createLanguageClient(extensionUri, initializationOptions, packageDirectories),
    catch: e => new LwcLanguageServerError({ message: isError(e) ? e.message : String(e) })
  }).pipe(
    Effect.tapError(error =>
      channelSvc.appendToChannel(
        nls.localize('lwc_language_server_start_failed', isError(error) ? error.message : String(error))
      )
    )
  );

  // Store client reference for restart capability
  languageClient = client;

  // Create language status item to show indexing progress
  const statusBarItem = new LwcLspStatusBarItem();
  extensionContext.subscriptions.push(statusBarItem);

  // Listen for server ready notification to update status
  client.onNotification(LWC_SERVER_READY_NOTIFICATION, () => {
    statusBarItem.ready();
    // Web E2E: language status is not always exposed in the status bar; tests wait on this log line.
    getRuntime().runFork(channelSvc.appendToChannel(nls.localize('lwc_language_server_indexing_complete')));
  });

  yield* channelSvc.appendToChannel(nls.localize('lwc_language_server_starting'));
  // Register workspace read file handler before start so the server can read files (e.g. sfdx-project.json) during initialize
  registerWorkspaceReadFileHandler(client, channelAdapter);

  yield* Effect.tryPromise({
    try: () => client.start(),
    catch: e => new LwcLanguageServerError({ message: isError(e) ? e.message : String(e) })
  }).pipe(
    Effect.tapError(startError =>
      channelSvc.appendToChannel(
        nls.localize(
          'lwc_language_server_client_start_failed',
          isError(startError) ? startError.message : String(startError)
        )
      )
    )
  );

  extensionContext.subscriptions.push(client);
  yield* channelSvc.appendToChannel(nls.localize('lwc_language_server_started'));
  yield* channelSvc.appendToChannel(nls.localize('lwc_language_server_output_channel_hint'));

  const registerCommand = api.services.registerCommandWithRuntime(getRuntime());
  yield* registerCommand('sf.metadata.lightning.generate.lwc', (outputDirParam?: URI) =>
    createLwcCommand(outputDirParam)
  );
  yield* registerCommand('sf.lightning.lwc.rename', renameLwcCommand);
  yield* registerCommand('sf.internal.lightning.generate.lwc', (sourceUri?: URI) =>
    createLwcCommand(sourceUri, { internal: true })
  );
  yield* Effect.forkDaemon(startLwcFileWatcher());
  // Watch sfdx-project.json for changes and restart the client to pick up new packageDirectories
  yield* Effect.forkDaemon(watchSfProjectForLwcClient());
  // Creates resources for js-meta.xml to work
  yield* activateMetaSupport(extensionContext.extensionUri);

  // Activate Test support (skip in web mode - test execution requires Node.js/terminal)
  if (process.env.ESBUILD_PLATFORM !== 'web') {
    yield* Effect.tryPromise(() => import('./testSupport/index.js')).pipe(
      // Lazy load test support to avoid bundling jest-editor-support in web mode
      Effect.tap(testSupport =>
        testSupport.shouldActivateLwcTestSupport(workspaceType)
          ? Effect.sync(() => testSupport.activateLwcTestSupport(extensionContext, workspaceType))
          : Effect.void
      ),
      Effect.catchAll(e => channelSvc.appendToChannel(nls.localize('lwc_test_support_load_failed', String(e))))
    );
  }

  yield* channelSvc.appendToChannel(nls.localize('lwc_extension_activation_complete'));
});

/**
 * Watches sfdx-project.json for changes and restarts the LWC language client to pick up
 * new or modified packageDirectories. This ensures file watchers remain scoped to the
 * current package directories even when they change mid-session.
 */
const watchSfProjectForLwcClient = Effect.fn('watchSfProjectForLwcClient')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const projectService = yield* api.services.ProjectService;
  const channelSvc = yield* api.services.ChannelService;

  yield* projectService.projectConfigChanges.pipe(
    Stream.debounce(Duration.millis(500)),
    Stream.runForEach(() =>
      Effect.gen(function* () {
        if (!languageClient) {
          return;
        }

        yield* channelSvc.appendToChannel(nls.localize('lwc_restarting_language_server'));

        // Fetch updated package directories
        const packageDirectories: string[] | undefined = yield* projectService.getSfProject().pipe(
          Effect.map(project => project.getPackageDirectories().map(dir => dir.path)),
          Effect.orElseSucceed(() => undefined)
        );

        // Stop the current client
        yield* Effect.tryPromise({
          try: () => languageClient!.stop(),
          catch: e => new LwcLanguageServerError({ message: isError(e) ? e.message : String(e) })
        });

        // Create and start a new client with updated package directories
        const newClient = yield* Effect.tryPromise({
          try: () => createLanguageClient(extensionUri, initializationOptions, packageDirectories),
          catch: e => new LwcLanguageServerError({ message: isError(e) ? e.message : String(e) })
        });

        // Register workspace read file handler before start
        registerWorkspaceReadFileHandler(newClient, channelAdapter);

        yield* Effect.tryPromise({
          try: () => newClient.start(),
          catch: e => new LwcLanguageServerError({ message: isError(e) ? e.message : String(e) })
        });

        // Update the module-level reference
        languageClient = newClient;

        yield* channelSvc.appendToChannel(nls.localize('lwc_language_server_restarted'));
      }).pipe(
        Effect.catchAll(error =>
          channelSvc.appendToChannel(
            nls.localize('lwc_language_server_restart_failed', isError(error) ? error.message : String(error))
          )
        )
      )
    )
  );
});

export const deactivate = () => {
  log('Lightning Web Components Extension Deactivated');
  telemetryService.sendEventData('extensionDeactivated');
};

const getActivationMode = (): string => {
  const config = workspace.getConfiguration('salesforcedx-vscode-lightning');
  return config.get('activationMode') ?? 'autodetect'; // default to autodetect
};
