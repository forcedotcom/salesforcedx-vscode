/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  closeExtensionScope,
  ExtensionProviderService,
  getExtensionScope
} from '@salesforce/effect-ext-utils';
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
import { DEPLOY_ON_SAVE_ENABLED, EXTENSION_NAME, METADATA_CONFIG_SECTION } from './constants';
import { createDeployOnSaveService } from './services/deployOnSaveService';
import { AllServicesLayer } from './services/extensionProvider';
import { createSourceTrackingStatusBar } from './statusBar/sourceTrackingStatusBar';

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const extensionScope = Effect.runSync(getExtensionScope());
  await Effect.runPromise(activateEffect(context).pipe(Effect.provide(AllServicesLayer), Scope.extend(extensionScope)));
};

export const deactivate = async (): Promise<void> =>
  Effect.runPromise(deactivateEffect().pipe(Effect.provide(AllServicesLayer)));

/** Check if this extension should register shared commands (when core is not installed or config enables it) */
const shouldRegisterSharedCommands = (): boolean => {
  const coreExtension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-core');
  const useMetadataCommands = vscode.workspace
    .getConfiguration('salesforcedx-vscode-core')
    .get<boolean>('useMetadataExtensionCommands', false);
  return !coreExtension || useMetadataCommands;
};

/** Activate the metadata extension */
export const activateEffect = Effect.fn(`activation:${EXTENSION_NAME}`)(function* (context: vscode.ExtensionContext) {
  const svc = yield* (yield* (yield* ExtensionProviderService).getServicesApi).services.ChannelService;
  yield* svc.appendToChannel('Salesforce Metadata extension activating');

  // Register shared commands only if core extension is not installed or config enables it
  if (shouldRegisterSharedCommands()) {
    yield* Effect.promise(() =>
      vscode.commands.executeCommand('setContext', 'salesforcedx-vscode-metadata.showSharedCommands', true)
    );

    yield* svc.appendToChannel('Registering shared commands (core extension not present or config enabled)');
    context.subscriptions.push(
      vscode.commands.registerCommand('sf.project.deploy.start', async () => projectDeployStart(false)),
      vscode.commands.registerCommand('sf.project.deploy.start.ignore.conflicts', async () => projectDeployStart(true)),
      vscode.commands.registerCommand('sf.project.retrieve.start', async () => projectRetrieveStart(false)),
      vscode.commands.registerCommand('sf.project.retrieve.start.ignore.conflicts', async () =>
        projectRetrieveStart(true)
      ),
      vscode.commands.registerCommand('sf.view.all.changes', viewAllChanges),
      vscode.commands.registerCommand('sf.view.local.changes', viewLocalChanges),
      vscode.commands.registerCommand('sf.view.remote.changes', viewRemoteChanges),
      vscode.commands.registerCommand('sf.source.tracking.reset.remote', resetRemoteTracking),
      vscode.commands.registerCommand('sf.apex.generate.class', createApexClass),
      vscode.commands.registerCommand('sf.delete.source', deleteSourcePaths),
      vscode.commands.registerCommand('sf.delete.source.current.file', deleteSourcePaths),
      vscode.commands.registerCommand('sf.deploy.source.path', deploySourcePaths),
      vscode.commands.registerCommand('sf.deploy.active.editor', deployActiveEditor),
      vscode.commands.registerCommand('sf.deploy.in.manifest', deployManifest),
      vscode.commands.registerCommand('sf.retrieve.source.path', retrieveSourcePaths),
      vscode.commands.registerCommand('sf.retrieve.current.source.file', retrieveSourcePaths),
      vscode.commands.registerCommand('sf.retrieve.in.manifest', retrieveManifest),
      vscode.commands.registerCommand('sf.project.generate.manifest', generateManifest),
      vscode.commands.registerCommand('sf.source.diff', sourceDiff)
    );

    if (process.env.ESBUILD_PLATFORM === 'web') {
      vscode.workspace.getConfiguration(METADATA_CONFIG_SECTION).update(DEPLOY_ON_SAVE_ENABLED, true);
    }
    // Start deploy on save service only if this extension handles shared commands
    yield* Effect.forkIn(createDeployOnSaveService(), yield* getExtensionScope());

    // Register source tracking status bar
    yield* Effect.forkIn(createSourceTrackingStatusBar(), yield* getExtensionScope());
  }

  yield* svc.appendToChannel('Salesforce Metadata activation complete.');
});

export const deactivateEffect = Effect.fn(`deactivation:${EXTENSION_NAME}`)(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* closeExtensionScope();
  yield* svc.appendToChannel('Salesforce Metadata extension is now deactivated!');
});
