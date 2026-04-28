/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { ApexActionController, createApexActionFromClass, validateOpenApiDocument } from './commands';
import { MetadataOrchestrator } from './commands/metadataOrchestrator';
import { getVscodeCoreExtension } from './coreExtensionUtils';
import { checkIfESRIsDecomposed } from './oasUtils';
import { buildAllServicesLayer, setAllServicesLayer } from './services/extensionProvider';
import { getRuntime } from './services/runtime';
import { telemetryService } from './telemetry';

const metadataOrchestrator = new MetadataOrchestrator();

// Apex Action Controller
export const apexActionController = new ApexActionController(metadataOrchestrator);

export const activate = async (context: vscode.ExtensionContext) => {
  setAllServicesLayer(buildAllServicesLayer(context));
  await getRuntime().runPromise(activateEffect(context));
  return {};
};

export const activateEffect = Effect.fn('activation:salesforcedx-vscode-apex-oas')(function* (
  context: vscode.ExtensionContext
) {
  // Check if Einstein GPT extension (A4V) is installed and active
  const einsteinGptExtension = vscode.extensions.getExtension('salesforce.salesforcedx-einstein-gpt');
  if (!einsteinGptExtension) {
    console.log('Einstein GPT extension not found. OAS extension will not activate.');
    return;
  }

  const vscodeCoreExtension = yield* Effect.promise(() => getVscodeCoreExtension());
  const workspaceContext = vscodeCoreExtension.exports.WorkspaceContext.getInstance();

  // Workspace Context
  yield* Effect.promise(() => workspaceContext.initialize(context));
  yield* Effect.promise(() => WorkspaceContextUtil.getInstance().initialize(context));

  // Initialize the apexActionController
  yield* Effect.promise(() => apexActionController.initialize(context));

  // Initialize if ESR xml is decomposed
  const isEsrDecomposed = yield* Effect.promise(() => checkIfESRIsDecomposed());
  void vscode.commands.executeCommand('setContext', 'sf:is_esr_decomposed', isEsrDecomposed);

  // Set context based on mulesoft extension
  const muleDxApiExtension = vscode.extensions.getExtension('salesforce.mule-dx-agentforce-api-component');
  yield* Effect.promise(() =>
    vscode.commands.executeCommand('setContext', 'sf:muleDxApiInactive', !muleDxApiExtension?.isActive)
  );

  // Only register commands if Einstein GPT extension is active
  if (einsteinGptExtension.isActive) {
    context.subscriptions.push(registerCommands());
  }
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
