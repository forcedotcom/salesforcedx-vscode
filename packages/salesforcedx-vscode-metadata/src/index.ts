/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SObjectRefreshSource } from './sobjects/types/general';
import { closeExtensionScope, ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { createLwcCommand } from './commands/createLwc';
import { deleteSourcePathsCommand } from './commands/deleteSourcePath';
import { deployManifestCommand } from './commands/deployManifest';
import { deployActiveEditorCommand, deploySourcePathsCommand } from './commands/deploySourcePath';
import { generateManifestCommand } from './commands/generateManifest';
import { projectDeployStartCommand } from './commands/projectDeployStart';
import { refreshSObjectsCommand } from './commands/refreshSObjects';
import { resetRemoteTrackingCommand } from './commands/resetRemoteTracking';
import { retrieveManifestCommand } from './commands/retrieveManifest';
import { retrieveSourcePathsCommand } from './commands/retrieveSourcePath';
import { projectRetrieveStartCommand } from './commands/retrieveStart/projectRetrieveStart';
import { viewChangesCommand } from './commands/showSourceTrackingDetails';
import { sourceDiffCommand } from './commands/sourceDiff';
import {
  conflictDiffCommandEffect,
  conflictOpenCommandEffect,
  openConflictViewCommand,
  setConflictViewContext
} from './conflict/conflictView';
import { CORE_CONFIG_SECTION, EXTENSION_NAME, DEPLOY_ON_SAVE_ENABLED } from './constants';
import { createDeployOnSaveService } from './services/deployOnSaveService';
import {
  AllServicesLayer,
  buildAllServicesLayer,
  getMetadataRuntime,
  setAllServicesLayer
} from './services/extensionProvider';
import { createSourceTrackingStatusBar } from './statusBar/sourceTrackingStatusBar';

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const extensionScope = Effect.runSync(getExtensionScope());
  setAllServicesLayer(buildAllServicesLayer(context));
  await getMetadataRuntime().runPromise(activateEffect(context).pipe(Scope.extend(extensionScope)));
};

export const deactivate = async (): Promise<void> => getMetadataRuntime().runPromise(deactivateEffect());

/** Activate the metadata extension */
export const activateEffect = Effect.fn(`activation:${EXTENSION_NAME}`)(function* (context: vscode.ExtensionContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* svc.appendToChannel('Salesforce Metadata extension activating');

  // Create registerCommand pre-loaded with AllServicesLayer for proper tracing
  const registerCommand = api.services.registerCommandWithLayer(AllServicesLayer);

  yield* Effect.all(
    [
      svc.appendToChannel('Registering metadata commands'),
      registerCommand('sf.metadata.lightning.generate.lwc', createLwcCommand),
      registerCommand('sf.metadata.delete.source', (sourceUri?: URI, uris?: URI[]) =>
        deleteSourcePathsCommand(sourceUri, uris)
      ),
      registerCommand('sf.metadata.delete.source.current.file', () => deleteSourcePathsCommand(undefined, undefined)),
      registerCommand('sf.metadata.deploy.active.editor', deployActiveEditorCommand),
      registerCommand('sf.metadata.deploy.in.manifest', (manifestUri?: URI) => deployManifestCommand(manifestUri)),
      registerCommand('sf.metadata.deploy.source.path', deploySourcePathsCommand),
      registerCommand('sf.metadata.project.deploy.start', () => projectDeployStartCommand(false)),
      registerCommand('sf.metadata.project.deploy.start.ignore.conflicts', () => projectDeployStartCommand(true)),
      registerCommand('sf.metadata.project.generate.manifest', (sourceUri?: URI, uris?: URI[]) =>
        generateManifestCommand(sourceUri, uris)
      ),
      registerCommand('sf.metadata.project.retrieve.start', () => projectRetrieveStartCommand(false)),
      registerCommand('sf.metadata.project.retrieve.start.ignore.conflicts', () => projectRetrieveStartCommand(true)),
      registerCommand('sf.metadata.retrieve.current.source.file', () =>
        retrieveSourcePathsCommand(undefined, undefined)
      ),
      registerCommand('sf.metadata.retrieve.in.manifest', retrieveManifestCommand),
      registerCommand('sf.metadata.retrieve.source.path', (sourceUri?: URI, uris?: URI[]) =>
        retrieveSourcePathsCommand(sourceUri, uris)
      ),
      registerCommand('sf.metadata.source.diff', (sourceUri?: URI, uris?: URI[]) => sourceDiffCommand(sourceUri, uris)),
      registerCommand('sf.metadata.source.tracking.reset.remote', () => resetRemoteTrackingCommand()),
      registerCommand('sf.metadata.view.all.changes', () => viewChangesCommand({ local: true, remote: true })),
      registerCommand('sf.metadata.view.local.changes', () => viewChangesCommand({ local: true })),
      registerCommand('sf.metadata.view.remote.changes', () => viewChangesCommand({ remote: true })),
      registerCommand('sf.internal.refreshsobjects', (source?: SObjectRefreshSource) => refreshSObjectsCommand(source)),
      registerCommand('sf.conflict.diff', conflictDiffCommandEffect),
      registerCommand('sf.conflict.open', conflictOpenCommandEffect),
      registerCommand('sf.metadata.view.conflicts', () => openConflictViewCommand())
    ],
    { concurrency: 'unbounded' }
  );

  if (process.env.ESBUILD_PLATFORM === 'web') {
    vscode.workspace.getConfiguration(CORE_CONFIG_SECTION).update(DEPLOY_ON_SAVE_ENABLED, true);
  }
  setConflictViewContext(context);

  yield* Effect.all([
    // Start deploy on save service
    Effect.forkIn(createDeployOnSaveService(), yield* getExtensionScope()),
    // Register source tracking status bar
    Effect.forkIn(createSourceTrackingStatusBar(), yield* getExtensionScope())
  ]);

  yield* svc.appendToChannel('Salesforce Metadata activation complete.');
});

export const deactivateEffect = Effect.fn(`deactivation:${EXTENSION_NAME}`)(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* closeExtensionScope();
  yield* svc.appendToChannel('Salesforce Metadata extension is now deactivated!');
});
