/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ActivationTracker, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { ApexActionController, createApexActionFromClass, validateOpenApiDocument } from './commands';
import { MetadataOrchestrator } from './commands/metadataOrchestrator';
import { getVscodeCoreExtension } from './coreExtensionUtils';
import { checkIfESRIsDecomposed } from './oasUtils';
import { getTelemetryService, setTelemetryService } from './telemetry';

const metadataOrchestrator = new MetadataOrchestrator();

// Apex Action Controller
export const apexActionController = new ApexActionController(metadataOrchestrator);

export const activate = async (context: vscode.ExtensionContext) => {
  const vscodeCoreExtension = await getVscodeCoreExtension();
  const workspaceContext = vscodeCoreExtension.exports.WorkspaceContext.getInstance();

  // Telemetry
  const { name } = context.extension.packageJSON;
  const telemetryService = vscodeCoreExtension.exports.services.TelemetryService.getInstance(name);
  await telemetryService.initializeService(context);
  if (!telemetryService) {
    throw new Error('Could not fetch a telemetry service instance');
  }
  setTelemetryService(telemetryService);

  const activationTracker = new ActivationTracker(context, telemetryService);

  // Workspace Context
  await workspaceContext.initialize(context);
  await WorkspaceContextUtil.getInstance().initialize(context);

  // Initialize the apexActionController
  await apexActionController.initialize(context);

  // Initialize if ESR xml is decomposed
  void vscode.commands.executeCommand('setContext', 'sf:is_esr_decomposed', await checkIfESRIsDecomposed());

  // Set context based on mulesoft extension
  const muleDxApiExtension = vscode.extensions.getExtension('salesforce.mule-dx-agentforce-api-component');
  await vscode.commands.executeCommand('setContext', 'sf:muleDxApiInactive', !muleDxApiExtension?.isActive);

  // Commands
  const commands = registerCommands();
  context.subscriptions.push(commands);

  void activationTracker.markActivationStop();

  return {};
};

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
  getTelemetryService().sendExtensionDeactivationEvent();
};
