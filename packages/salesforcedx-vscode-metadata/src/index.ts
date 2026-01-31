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

/** Check if this extension should register shared commands (when core is not installed or config enables it) */
const shouldRegisterSharedCommands = (): boolean => {
  const coreExtension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-core');
  const useMetadataCommands = vscode.workspace
    .getConfiguration('salesforcedx-vscode-core')
    .get<boolean>('useMetadataExtensionCommands', false);
  return !coreExtension || useMetadataCommands;
};

/** Activate the metadata extension */
export const activateEffect = Effect.fn(`activation:${EXTENSION_NAME}`)(function* (_context: vscode.ExtensionContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* svc.appendToChannel('Salesforce Metadata extension activating');

  // Register shared commands only if core extension is not installed or config enables it
  if (shouldRegisterSharedCommands()) {
    yield* Effect.promise(() =>
      vscode.commands.executeCommand('setContext', 'salesforcedx-vscode-metadata.showSharedCommands', true)
    );

    yield* svc.appendToChannel('Registering shared commands (core extension not present or config enabled)');
    yield* api.services.registerCommand('sf.apex.generate.class', createApexClass);
    yield* api.services.registerCommand('sf.retrieve.in.manifest', retrieveManifest);

    yield* api.services.registerCommand('sf.project.deploy.start', () => projectDeployStart(false));
    yield* api.services.registerCommand('sf.project.deploy.start.ignore.conflicts', () => projectDeployStart(true));
    yield* api.services.registerCommand('sf.project.retrieve.start', () => projectRetrieveStartEffect(false));
    yield* api.services.registerCommand('sf.project.retrieve.start.ignore.conflicts', () =>
      projectRetrieveStartEffect(true)
    );
    yield* api.services.registerCommand('sf.view.all.changes', () => viewChangesEffect({ local: true, remote: true }));
    yield* api.services.registerCommand('sf.view.local.changes', () => viewChangesEffect({ local: true, remote: false }));
    yield* api.services.registerCommand('sf.view.remote.changes', () => viewChangesEffect({ local: false, remote: true }));
    yield* api.services.registerCommand('sf.source.tracking.reset.remote', () => resetRemoteTrackingEffect());
    yield* api.services.registerCommand('sf.delete.source', (sourceUri?: URI, uris?: URI[]) =>
      deleteSourcePathsEffect(sourceUri, uris)
    );
    yield* api.services.registerCommand('sf.delete.source.current.file', () => deleteSourcePathsEffect(undefined, undefined));
    yield* api.services.registerCommand('sf.deploy.source.path', (sourceUri: URI, uris: URI[] = []) =>
      deploySourcePathsEffect(sourceUri, uris)
    );
    yield* api.services.registerCommand('sf.deploy.active.editor', () => deployActiveEditorEffect());
    yield* api.services.registerCommand('sf.deploy.in.manifest', (manifestUri?: URI) => deployManifestEffect(manifestUri));
    yield* api.services.registerCommand('sf.retrieve.source.path', (sourceUri?: URI, uris?: URI[]) =>
      retrieveSourcePathsEffect(sourceUri, uris)
    );
    yield* api.services.registerCommand('sf.retrieve.current.source.file', () => retrieveSourcePathsEffect(undefined, undefined));
    yield* api.services.registerCommand('sf.project.generate.manifest', (sourceUri?: URI, uris?: URI[]) =>
      generateManifestEffect(sourceUri, uris)
    );
    yield* api.services.registerCommand('sf.source.diff', (sourceUri?: URI, uris?: URI[]) =>
      sourceDiffEffect(sourceUri, uris)
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
