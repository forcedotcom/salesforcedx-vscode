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
import { createApexClassCommand } from './commands/createApexClass';
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
import { CORE_CONFIG_SECTION, EXTENSION_NAME, DEPLOY_ON_SAVE_ENABLED } from './constants';
import { getShowSharedCommands, watchUseMetadataExtensionCommands } from './services/configWatcher';
import { createDeployOnSaveService } from './services/deployOnSaveService';
import { AllServicesLayer, buildAllServicesLayer, setAllServicesLayer } from './services/extensionProvider';
import { createSourceTrackingStatusBar } from './statusBar/sourceTrackingStatusBar';

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const extensionScope = Effect.runSync(getExtensionScope());
  setAllServicesLayer(buildAllServicesLayer(context));
  await Effect.runPromise(activateEffect(context).pipe(Effect.provide(AllServicesLayer), Scope.extend(extensionScope)));
};

export const deactivate = async (): Promise<void> =>
  Effect.runPromise(deactivateEffect().pipe(Effect.provide(AllServicesLayer)));

/** Activate the metadata extension */
export const activateEffect = Effect.fn(`activation:${EXTENSION_NAME}`)(function* (_context: vscode.ExtensionContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* svc.appendToChannel('Salesforce Metadata extension activating');

  const showSharedCommands = getShowSharedCommands();
  // you don't have the core ext (ex: web) OR you have it and have the setting to use the metadata extension commands
  yield* Effect.promise(() =>
    vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.showSharedCommands`, showSharedCommands)
  );

  // Create registerCommand pre-loaded with AllServicesLayer for proper tracing
  const registerCommand = api.services.registerCommandWithLayer(AllServicesLayer);

  yield* Effect.all(
    [
      svc.appendToChannel('Registering metadata commands'),
      registerCommand('sf.metadata.apex.generate.class', createApexClassCommand),
      registerCommand('sf.metadata.delete.source', (sourceUri?: URI, uris?: URI[]) =>
        deleteSourcePathsCommand(sourceUri, uris)
      ),
      registerCommand('sf.metadata.delete.source.current.file', () => deleteSourcePathsCommand(undefined, undefined)),
      registerCommand('sf.metadata.deploy.active.editor', () => deployActiveEditorCommand()),
      registerCommand('sf.metadata.deploy.in.manifest', (manifestUri?: URI) => deployManifestCommand(manifestUri)),
      registerCommand('sf.metadata.deploy.source.path', (sourceUri: URI, uris: URI[] = []) =>
        deploySourcePathsCommand(sourceUri, uris)
      ),
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
      registerCommand('sf.metadata.view.local.changes', () => viewChangesCommand({ local: true, remote: false })),
      registerCommand('sf.metadata.view.remote.changes', () => viewChangesCommand({ local: false, remote: true })),
      registerCommand('sf.internal.refreshsobjects', (source?: SObjectRefreshSource) =>
        refreshSObjectsCommand(source)
      )
    ],
    { concurrency: 'unbounded' }
  );

  if (process.env.ESBUILD_PLATFORM === 'web') {
    vscode.workspace.getConfiguration(CORE_CONFIG_SECTION).update(DEPLOY_ON_SAVE_ENABLED, true);
  }
  yield* Effect.all([
    // Start deploy on save service
    Effect.forkIn(createDeployOnSaveService(), yield* getExtensionScope()),
    // Register source tracking status bar
    ...(showSharedCommands ? [Effect.forkIn(createSourceTrackingStatusBar(), yield* getExtensionScope())] : []),
    // Watch for config changes to update showSharedCommands context
    Effect.forkIn(watchUseMetadataExtensionCommands(), yield* getExtensionScope())
  ]);

  yield* svc.appendToChannel('Salesforce Metadata activation complete.');
});

export const deactivateEffect = Effect.fn(`deactivation:${EXTENSION_NAME}`)(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* closeExtensionScope();
  yield* svc.appendToChannel('Salesforce Metadata extension is now deactivated!');
});
