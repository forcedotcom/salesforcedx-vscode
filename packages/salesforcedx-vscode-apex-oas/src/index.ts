/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { buildAllServicesLayer } from '@salesforce/effect-ext-utils';
import { WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { ApexActionController, createApexActionFromClass, validateOpenApiDocument } from './commands';
import { MetadataOrchestrator } from './commands/metadataOrchestrator';
import { getVscodeCoreExtension } from './coreExtensionUtils';
import { nls } from './messages';
import { setAllServicesLayer } from './services/extensionProvider';
import { getRuntime } from './services/runtime';
import { telemetryService } from './telemetry';

const metadataOrchestrator = new MetadataOrchestrator();

// Apex Action Controller
export const apexActionController = new ApexActionController(metadataOrchestrator);

export const activate = async (context: vscode.ExtensionContext) => {
  setAllServicesLayer(buildAllServicesLayer(context, nls.localize('channel_name')));
  await getRuntime().runPromise(activateEffect(context));
  return {};
};

export const activateEffect = Effect.fn('activation:salesforcedx-vscode-apex-oas')(function* (
  context: vscode.ExtensionContext
) {
  const vscodeCoreExtension = yield* Effect.promise(() => getVscodeCoreExtension());
  const workspaceContext = vscodeCoreExtension.exports.WorkspaceContext.getInstance();

  yield* Effect.promise(() => workspaceContext.initialize(context));
  yield* Effect.promise(() => WorkspaceContextUtil.getInstance().initialize(context));

  yield* Effect.promise(() => apexActionController.initialize(context));

  context.subscriptions.push(registerCommands());
});

const registerCommands = (): vscode.Disposable => {
  const createApexActionFromClassCmd = vscode.commands.registerCommand(
    'sf.create.apex.action.class',
    createApexActionFromClass
  );
  const validateOpenApiDocumentCmd = vscode.commands.registerCommand(
    'sf.validate.oas.document',
    validateOpenApiDocument
  );

  return vscode.Disposable.from(createApexActionFromClassCmd, validateOpenApiDocumentCmd);
};

export const deactivate = async () => {
  telemetryService.sendExtensionDeactivationEvent();
};
