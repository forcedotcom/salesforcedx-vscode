/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import {
  isLWC,
  LWC_SERVER_READY_NOTIFICATION,
  type WorkspaceType
} from '@salesforce/salesforcedx-lightning-lsp-common';
import { detectWorkspaceType } from '@salesforce/salesforcedx-lightning-lsp-common/detectWorkspaceTypeVscode';
import { registerWorkspaceReadFileHandler } from '@salesforce/salesforcedx-lightning-lsp-common/workspaceReadFileHandler';
import * as Effect from 'effect/Effect';
import { ExtensionContext, workspace } from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { channelAdapter } from './channel';
import { createLwcCommand } from './commands/createLwc';
import { log } from './constants';
import { createLanguageClient } from './languageClient';
import LwcLspStatusBarItem from './lwcLspStatusBarItem';
import { activateMetaSupport } from './metasupport/metaSupport';
import { buildAllServicesLayer, setAllServicesLayer } from './services/extensionProvider';
import { getRuntime } from './services/runtime';
import { startLwcFileWatcher } from './util/lwcFileWatcher';

const getTelemetryService = async () => {
  const telemetryModule = await import('./telemetry/index.js');
  return telemetryModule.telemetryService;
};

export const activate = async (extensionContext: ExtensionContext) => {
  // Initialize services layer first so ChannelService and other services are available throughout activation.
  setAllServicesLayer(buildAllServicesLayer(extensionContext));
  await getRuntime().runPromise(activateEffect(extensionContext));
};

export const activateEffect = Effect.fn('activation:salesforcedx-vscode-lwc')(function* (
  extensionContext: ExtensionContext
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelSvc = yield* api.services.ChannelService;

  yield* channelSvc.appendToChannel('Lightning Web Components extension activating...');

  if (process.env.ESBUILD_PLATFORM !== 'web') {
    yield* Effect.promise(() => getTelemetryService()).pipe(
      Effect.flatMap(telemetryService => Effect.promise(() => telemetryService.initializeService(extensionContext))),
      Effect.catchAll(e => channelSvc.appendToChannel(`Failed to initialize telemetry service: ${String(e)}`))
    );
  }

  // Run our auto detection routine before we activate
  // If activationMode is off, don't startup no matter what
  if (getActivationMode() === 'off') {
    yield* channelSvc.appendToChannel('LWC Language Server activationMode set to off, exiting...');
    return;
  }

  // if we have no workspace folders, exit
  if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
    yield* channelSvc.appendToChannel('No workspace folders found, exiting extension');
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
    yield* channelSvc.appendToChannel(
      `LWC LSP - autodetect did not find a valid project structure, exiting. WorkspaceType detected: ${workspaceType}`
    );
    return;
  }

  // Start the LWC Language Server
  const sfdxTypingsDir = Utils.joinPath(
    URI.from(extensionContext.extensionUri),
    'resources',
    'sfdx',
    'typings'
  ).toString();

  const client = yield* Effect.tryPromise({
    try: () => createLanguageClient(extensionContext.extensionUri, { workspaceType, sfdxTypingsDir }),
    catch: e => e
  }).pipe(
    Effect.tapError(error =>
      channelSvc.appendToChannel(
        `Failed to start LWC Language Server: ${error instanceof Error ? error.message : String(error)}`
      )
    )
  );

  // Create language status item to show indexing progress
  const statusBarItem = new LwcLspStatusBarItem();
  extensionContext.subscriptions.push(statusBarItem);

  // Listen for server ready notification to update status
  client.onNotification(LWC_SERVER_READY_NOTIFICATION, () => {
    statusBarItem.ready();
    // Web E2E: language status is not always exposed in the status bar; tests wait on this log line.
    getRuntime().runFork(channelSvc.appendToChannel('LWC Language Server: indexing complete'));
  });

  yield* channelSvc.appendToChannel('Starting LWC Language Server...');
  // Register workspace read file handler before start so the server can read files (e.g. sfdx-project.json) during initialize
  registerWorkspaceReadFileHandler(client, channelAdapter);

  yield* Effect.tryPromise({ try: () => client.start(), catch: e => e }).pipe(
    Effect.tapError(startError =>
      channelSvc.appendToChannel(
        `[LWC] Failed to start client: ${startError instanceof Error ? startError.message : String(startError)}`
      )
    )
  );

  extensionContext.subscriptions.push(client);
  yield* channelSvc.appendToChannel('LWC Language Server started successfully');
  yield* channelSvc.appendToChannel('Check "LWC Language Server" output channel for server logs');

  const registerCommand = api.services.registerCommandWithRuntime(getRuntime());
  yield* registerCommand('sf.metadata.lightning.generate.lwc', (outputDirParam?: URI) =>
    createLwcCommand(outputDirParam)
  );
  yield* Effect.forkDaemon(startLwcFileWatcher());
  // Creates resources for js-meta.xml to work
  yield* activateMetaSupport(extensionContext.extensionUri);

  // Activate Test support (skip in web mode - test execution requires Node.js/terminal)
  if (process.env.ESBUILD_PLATFORM !== 'web') {
    yield* Effect.promise(() => import('./testSupport/index.js')).pipe(
      // Lazy load test support to avoid bundling jest-editor-support in web mode
      Effect.tap(testSupport =>
        testSupport.shouldActivateLwcTestSupport(workspaceType)
          ? Effect.sync(() => testSupport.activateLwcTestSupport(extensionContext, workspaceType))
          : Effect.void
      ),
      Effect.catchAll(e => channelSvc.appendToChannel(`Failed to load test support: ${String(e)}`))
    );
  }

  yield* channelSvc.appendToChannel('Lightning Web Components extension activation complete.');
});

export const deactivate = async () => {
  log('Lightning Web Components Extension Deactivated');
  if (process.env.ESBUILD_PLATFORM !== 'web') {
    const telemetryService = await getTelemetryService();
    telemetryService.sendExtensionDeactivationEvent();
  }
};

const getActivationMode = (): string => {
  const config = workspace.getConfiguration('salesforcedx-vscode-lightning');
  return config.get('activationMode') ?? 'autodetect'; // default to autodetect
};
