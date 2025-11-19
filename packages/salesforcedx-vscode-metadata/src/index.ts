/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { projectDeployStart } from './commands/deployStart/projectDeployStart';
import { projectRetrieveStart } from './commands/retrieveStart/projectRetrieveStart';
import { showSourceTrackingDetails } from './commands/showSourceTrackingDetails';
import { EXTENSION_NAME } from './constants';
import { AllServicesLayer, ExtensionProviderService } from './services/extensionProvider';
import { closeExtensionScope, getExtensionScope } from './services/extensionScope';
import { createSourceTrackingStatusBar } from './statusBar/sourceTrackingStatusBar';

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const extensionScope = Effect.runSync(getExtensionScope());
  await Effect.runPromise(Effect.provide(activateEffect(context), AllServicesLayer).pipe(Scope.extend(extensionScope)));
};

export const deactivate = async (): Promise<void> =>
  Effect.runPromise(Effect.provide(deactivateEffect, AllServicesLayer));

/** Activate the metadata extension */
export const activateEffect = (
  context: vscode.ExtensionContext
): Effect.Effect<void, Error, ExtensionProviderService | Scope.Scope> =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const svc = yield* api.services.ChannelService;
    yield* svc.appendToChannel('Salesforce Metadata extension activating');

    // Register commands
    context.subscriptions.push(
      vscode.commands.registerCommand('sf.metadata.deploy.start', async () => projectDeployStart(false)),
      vscode.commands.registerCommand('sf.metadata.deploy.start.ignore.conflicts', async () =>
        projectDeployStart(true)
      ),
      vscode.commands.registerCommand('sf.metadata.retrieve.start', projectRetrieveStart),
      vscode.commands.registerCommand('sf.metadata.source.tracking.details', showSourceTrackingDetails)
    );

    // Register source tracking status bar
    yield* Effect.forkIn(createSourceTrackingStatusBar(), yield* getExtensionScope());

    yield* svc.appendToChannel('Salesforce Metadata activation complete.');
  }).pipe(Effect.withSpan(`activation:${EXTENSION_NAME}`), Effect.provide(AllServicesLayer));

export const deactivateEffect = Effect.gen(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* closeExtensionScope();
  yield* svc.appendToChannel('Salesforce Metadata extension is now deactivated!');
}).pipe(Effect.withSpan(`deactivation:${EXTENSION_NAME}`), Effect.provide(AllServicesLayer));
