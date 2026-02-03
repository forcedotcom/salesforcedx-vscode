/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { closeExtensionScope, ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { createApexClass } from './commands/createApexClass';
import { deleteSourcePathsEffect } from './commands/deleteSourcePath';
import { deployManifestEffect } from './commands/deployManifest';
import { deployActiveEditorEffect, deploySourcePathsEffect } from './commands/deploySourcePath';
import { generateManifestEffect } from './commands/generateManifest';
import { projectDeployStart } from './commands/projectDeployStart';
import { resetRemoteTrackingEffect } from './commands/resetRemoteTracking';
import { retrieveManifest } from './commands/retrieveManifest';
import { retrieveSourcePathsEffect } from './commands/retrieveSourcePath';
import { projectRetrieveStartEffect } from './commands/retrieveStart/projectRetrieveStart';
import { viewChangesEffect } from './commands/showSourceTrackingDetails';
import { sourceDiffEffect } from './commands/sourceDiff';
import { DEPLOY_ON_SAVE_ENABLED, EXTENSION_NAME, METADATA_CONFIG_SECTION } from './constants';
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

  // you don't have the core ext (ex: web) OR you have it and have the setting to use the metadata extension commands
  yield* Effect.promise(() =>
    vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.showSharedCommands`, getShowSharedCommands())
  );

  // Create registerCommand pre-loaded with AllServicesLayer for proper tracing
  const registerCommand = api.services.registerCommandWithLayer(AllServicesLayer);

  yield* Effect.all(
    [
      svc.appendToChannel('Registering metadata commands'),
      registerCommand('sf.metadata.apex.generate.class', createApexClass),
      registerCommand('sf.metadata.retrieve.in.manifest', retrieveManifest),
      registerCommand('sf.metadata.project.deploy.start', () => projectDeployStart(false)),
      registerCommand('sf.metadata.project.deploy.start.ignore.conflicts', () => projectDeployStart(true)),
      registerCommand('sf.metadata.project.retrieve.start', () => projectRetrieveStartEffect(false)),
      registerCommand('sf.metadata.project.retrieve.start.ignore.conflicts', () => projectRetrieveStartEffect(true)),
      registerCommand('sf.metadata.view.all.changes', () => viewChangesEffect({ local: true, remote: true })),
      registerCommand('sf.metadata.view.local.changes', () => viewChangesEffect({ local: true, remote: false })),
      registerCommand('sf.metadata.view.remote.changes', () => viewChangesEffect({ local: false, remote: true })),
      registerCommand('sf.metadata.source.tracking.reset.remote', () => resetRemoteTrackingEffect()),
      registerCommand('sf.metadata.delete.source', (sourceUri?: URI, uris?: URI[]) =>
        deleteSourcePathsEffect(sourceUri, uris)
      ),
      registerCommand('sf.metadata.delete.source.current.file', () => deleteSourcePathsEffect(undefined, undefined)),
      registerCommand('sf.metadata.deploy.source.path', (sourceUri: URI, uris: URI[] = []) =>
        deploySourcePathsEffect(sourceUri, uris)
      ),
      registerCommand('sf.metadata.deploy.active.editor', () => deployActiveEditorEffect()),
      registerCommand('sf.metadata.deploy.in.manifest', (manifestUri?: URI) => deployManifestEffect(manifestUri)),
      registerCommand('sf.metadata.retrieve.source.path', (sourceUri?: URI, uris?: URI[]) =>
        retrieveSourcePathsEffect(sourceUri, uris)
      ),
      registerCommand('sf.metadata.retrieve.current.source.file', () =>
        retrieveSourcePathsEffect(undefined, undefined)
      ),
      registerCommand('sf.metadata.project.generate.manifest', (sourceUri?: URI, uris?: URI[]) =>
        generateManifestEffect(sourceUri, uris)
      ),
      registerCommand('sf.metadata.source.diff', (sourceUri?: URI, uris?: URI[]) => sourceDiffEffect(sourceUri, uris))
    ],
    { concurrency: 'unbounded' }
  );

  if (process.env.ESBUILD_PLATFORM === 'web') {
    vscode.workspace.getConfiguration(METADATA_CONFIG_SECTION).update(DEPLOY_ON_SAVE_ENABLED, true);
  }
  yield* Effect.all([
    // Start deploy on save service
    Effect.forkIn(createDeployOnSaveService(), yield* getExtensionScope()),
    // Register source tracking status bar
    Effect.forkIn(createSourceTrackingStatusBar(), yield* getExtensionScope()),
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
