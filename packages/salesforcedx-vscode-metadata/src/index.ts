/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { projectDeployStart } from './commands/deployStart/projectDeployStart';
import { EXTENSION_NAME } from './constants';
import { AllServicesLayer, ExtensionProviderService } from './services/extensionProvider';
import { SourceTrackingStatusBar } from './statusBar/sourceTrackingStatusBar';

export const activate = async (context: vscode.ExtensionContext): Promise<void> =>
  Effect.runPromise(Effect.provide(activateEffect(context), AllServicesLayer));

export const deactivate = async (): Promise<void> =>
  Effect.runPromise(Effect.provide(deactivateEffect, AllServicesLayer));

/** Activate the metadata extension */
export const activateEffect = (
  context: vscode.ExtensionContext
): Effect.Effect<void, Error, ExtensionProviderService> =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const svc = yield* api.services.ChannelService;
    yield* svc.appendToChannel('Salesforce Metadata extension activating');

    // Register commands
    context.subscriptions.push(
      vscode.commands.registerCommand('sf.project.deploy.start', async () => projectDeployStart(false)),
      vscode.commands.registerCommand('sf.project.deploy.start.ignore.conflicts', async () => projectDeployStart(true))
    );

    // Register source tracking status bar
    const statusBar = yield* Effect.promise(() => SourceTrackingStatusBar.create(api));
    context.subscriptions.push(statusBar);

    yield* svc.appendToChannel('Salesforce Metadata activation complete.');
  }).pipe(Effect.withSpan(`activation:${EXTENSION_NAME}`), Effect.provide(AllServicesLayer));

export const deactivateEffect = ExtensionProviderService.pipe(
  Effect.flatMap(svcProvider => svcProvider.getServicesApi),
  Effect.flatMap(api => api.services.ChannelService),
  Effect.flatMap(svc => svc.appendToChannel('Salesforce Metadata extension is now deactivated!')),
  Effect.withSpan(`deactivation:${EXTENSION_NAME}`),
  Effect.provide(AllServicesLayer)
);
