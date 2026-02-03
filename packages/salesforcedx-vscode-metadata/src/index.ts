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
import { createApexClass } from './commands/createApexClass';
import { deleteSourcePaths } from './commands/deleteSourcePath';
import { deployManifest } from './commands/deployManifest';
import { deployActiveEditor, deploySourcePaths } from './commands/deploySourcePath';
import { generateManifest } from './commands/generateManifest';
import { projectDeployStart } from './commands/projectDeployStart';
import { resetRemoteTracking } from './commands/resetRemoteTracking';
import { retrieveManifest } from './commands/retrieveManifest';
import { retrieveSourcePaths } from './commands/retrieveSourcePath';
import { projectRetrieveStart } from './commands/retrieveStart/projectRetrieveStart';
import { viewAllChanges, viewLocalChanges, viewRemoteChanges } from './commands/showSourceTrackingDetails';
import { sourceDiff } from './commands/sourceDiff';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED, EXTENSION_NAME } from './constants';
import { getShowSharedCommands, watchUseMetadataExtensionCommands } from './services/configWatcher';
import { createDeployOnSaveService } from './services/deployOnSaveService';
import { AllServicesLayer } from './services/extensionProvider';
import { createSourceTrackingStatusBar } from './statusBar/sourceTrackingStatusBar';

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const extensionScope = Effect.runSync(getExtensionScope());
  await Effect.runPromise(activateEffect(context).pipe(Effect.provide(AllServicesLayer), Scope.extend(extensionScope)));
};

export const deactivate = async (): Promise<void> =>
  Effect.runPromise(deactivateEffect().pipe(Effect.provide(AllServicesLayer)));

/** Activate the metadata extension */
export const activateEffect = Effect.fn(`activation:${EXTENSION_NAME}`)(function* (context: vscode.ExtensionContext) {
  const svc = yield* (yield* (yield* ExtensionProviderService).getServicesApi).services.ChannelService;
  yield* svc.appendToChannel('Salesforce Metadata extension activating');

  // you don't have the core ext (ex: web) OR you have it and have the setting to use the metadata extension commands
  yield* Effect.promise(() =>
    vscode.commands.executeCommand('setContext', `${EXTENSION_NAME}.showSharedCommands`, getShowSharedCommands())
  );

  yield* svc.appendToChannel('Registering metadata commands');
  context.subscriptions.push(
    vscode.commands.registerCommand('sf.metadata.project.deploy.start', async () => projectDeployStart(false)),
    vscode.commands.registerCommand('sf.metadata.project.deploy.start.ignore.conflicts', async () =>
      projectDeployStart(true)
    ),
    vscode.commands.registerCommand('sf.metadata.project.retrieve.start', async () => projectRetrieveStart(false)),
    vscode.commands.registerCommand('sf.metadata.project.retrieve.start.ignore.conflicts', async () =>
      projectRetrieveStart(true)
    ),
    vscode.commands.registerCommand('sf.metadata.view.all.changes', viewAllChanges),
    vscode.commands.registerCommand('sf.metadata.view.local.changes', viewLocalChanges),
    vscode.commands.registerCommand('sf.metadata.view.remote.changes', viewRemoteChanges),
    vscode.commands.registerCommand('sf.metadata.source.tracking.reset.remote', resetRemoteTracking),
    vscode.commands.registerCommand('sf.metadata.apex.generate.class', createApexClass),
    vscode.commands.registerCommand('sf.metadata.delete.source', deleteSourcePaths),
    vscode.commands.registerCommand('sf.metadata.delete.source.current.file', deleteSourcePaths),
    vscode.commands.registerCommand('sf.metadata.deploy.source.path', deploySourcePaths),
    vscode.commands.registerCommand('sf.metadata.deploy.active.editor', deployActiveEditor),
    vscode.commands.registerCommand('sf.metadata.deploy.in.manifest', deployManifest),
    vscode.commands.registerCommand('sf.metadata.retrieve.source.path', retrieveSourcePaths),
    vscode.commands.registerCommand('sf.metadata.retrieve.current.source.file', retrieveSourcePaths),
    vscode.commands.registerCommand('sf.metadata.retrieve.in.manifest', retrieveManifest),
    vscode.commands.registerCommand('sf.metadata.project.generate.manifest', generateManifest),
    vscode.commands.registerCommand('sf.metadata.source.diff', sourceDiff)
  );

  if (process.env.ESBUILD_PLATFORM === 'web') {
    vscode.workspace.getConfiguration(CORE_CONFIG_SECTION).update(DEPLOY_ON_SAVE_ENABLED, true);
  }
  // Start deploy on save service
  yield* Effect.forkIn(createDeployOnSaveService(), yield* getExtensionScope());

  // Register source tracking status bar
  yield* Effect.forkIn(createSourceTrackingStatusBar(), yield* getExtensionScope());

  // Watch for config changes to update showSharedCommands context
  yield* Effect.forkIn(watchUseMetadataExtensionCommands(), yield* getExtensionScope());

  yield* svc.appendToChannel('Salesforce Metadata activation complete.');
});

export const deactivateEffect = Effect.fn(`deactivation:${EXTENSION_NAME}`)(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* closeExtensionScope();
  yield* svc.appendToChannel('Salesforce Metadata extension is now deactivated!');
});
