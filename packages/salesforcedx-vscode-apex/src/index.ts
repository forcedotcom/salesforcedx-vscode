/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionPackageJsonSchema, type ExtensionPackageJson } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import ApexLSPStatusBarItem from './apexLspStatusBarItem';
import { getVscodeCoreExtension } from './coreExtensionUtils';
import { languageServerOrphanHandler as lsoh } from './languageServerOrphanHandler';
import {
  configureApexLanguage,
  getApexTests,
  getExceptionBreakpointInfo,
  getLineBreakpointInfo,
  languageClientManager,
  restartLanguageServerAndClient,
  createLanguageClient
} from './languageUtils';
import { nls } from './messages';
import { buildAllServicesLayer, setAllServicesLayer } from './services/extensionProvider';
import { getRuntime } from './services/runtime';
import { getTelemetryService, setTelemetryService } from './telemetry/telemetry';

export const activate = async (context: vscode.ExtensionContext) => {
  setAllServicesLayer(buildAllServicesLayer(context));
  await getRuntime().runPromise(activateEffect(context));
  return {
    getLineBreakpointInfo,
    getExceptionBreakpointInfo,
    getApexTests,
    languageClientManager
  };
};

export const activateEffect = Effect.fn('activation:salesforcedx-vscode-apex')(function* (
  context: vscode.ExtensionContext
) {
  const vscodeCoreExtension = yield* Effect.promise(() => getVscodeCoreExtension());
  const workspaceContext = vscodeCoreExtension.exports.WorkspaceContext.getInstance();

  // Telemetry
  const pjson = yield* Schema.decodeUnknown(ExtensionPackageJsonSchema)(context.extension.packageJSON).pipe(
    Effect.catchAll(() => Effect.succeed<ExtensionPackageJson>({}))
  );
  const telemetryService = vscodeCoreExtension.exports.services.TelemetryService.getInstance(pjson.name);
  yield* Effect.promise(() => telemetryService.initializeService(context));
  if (!telemetryService) {
    throw new Error('Could not fetch a telemetry service instance');
  }
  setTelemetryService(telemetryService);

  if (!vscode.workspace?.workspaceFolders) {
    throw new Error(nls.localize('cannot_determine_workspace'));
  }

  // Workspace Context
  yield* Effect.promise(() => workspaceContext.initialize(context));

  // start the language server and client
  const languageServerStatusBarItem = new ApexLSPStatusBarItem();
  languageClientManager.setStatusBarInstance(languageServerStatusBarItem);
  yield* Effect.promise(() => createLanguageClient(context, languageServerStatusBarItem));

  yield* Effect.sync(() => {
    // Register settings change handler for LSP parity capabilities
    const lspParitySettingsWatcher = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('salesforcedx-vscode-apex.advanced.lspParityCapabilities')) {
        void vscode.commands.executeCommand('sf.apex.languageServer.restart', 'commandPalette');
      }
    });
    context.subscriptions.push(lspParitySettingsWatcher);

    // Javadoc support
    configureApexLanguage();

    // Commands
    const commands = registerCommands(context);
    context.subscriptions.push(commands);
  });

  setImmediate(() => {
    // Resolve any found orphan language servers in the background
    void lsoh.resolveAnyFoundOrphanLanguageServers();
  });
});

const registerCommands = (context: vscode.ExtensionContext): vscode.Disposable => {
  // Customer-facing commands (log.get and anon.execute.* moved to salesforcedx-vscode-apex-log)
  const anonApexRunDelegateCmd = vscode.commands.registerCommand('sf.anon.apex.run.delegate', () =>
    vscode.commands.executeCommand('sf.anon.apex.execute.document')
  );
  const restartApexLanguageServerCmd = vscode.commands.registerCommand(
    'sf.apex.languageServer.restart',
    async (source?: 'commandPalette' | 'statusBar') => {
      await restartLanguageServerAndClient(context, source ?? 'commandPalette');
    }
  );

  return vscode.Disposable.from(anonApexRunDelegateCmd, restartApexLanguageServerCmd);
};

export const deactivate = async () => {
  await languageClientManager.getClientInstance()?.stop(30_000);
  getTelemetryService().sendExtensionDeactivationEvent();
};

export type {
  ApexClassOASEligibleRequestForLSPProtocol,
  ApexClassOASEligibleResponseForLSPProtocol
} from './apexLanguageClient';
export type { LanguageClientManager } from './languageUtils/languageClientManager';

// Export OAS schema types for other extensions to consume
export type {
  ApexClassOASEligibleRequest,
  ApexClassOASEligibleResponse,
  ApexClassOASEligibleResponses,
  ApexOASEligiblePayload,
  ApexClassOASGatherContextResponse,
  ApexOASClassDetail,
  ApexOASPropertyDetail,
  ApexOASMethodDetail,
  ApexOASInterface,
  ApexAnnotationDetail
} from './oasSchemas';

export type ApexVSCodeApi = {
  getLineBreakpointInfo: typeof getLineBreakpointInfo;
  getExceptionBreakpointInfo: typeof getExceptionBreakpointInfo;
  getApexTests: typeof getApexTests;
  languageClientManager: typeof languageClientManager;
};
