/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  buildAllServicesLayer,
  closeExtensionScope,
  ExtensionPackageJsonSchema,
  ExtensionProviderService,
  type ExtensionPackageJson,
  getExtensionScope
} from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import ApexLSPStatusBarItem from './apexLspStatusBarItem';
import { getVscodeCoreExtension } from './coreExtensionUtils';
import { checkAndResolveOrphanedLanguageServers } from './languageServerOrphanHandler';
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
import { setAllServicesLayer } from './services/extensionProvider';
import { getRuntime } from './services/runtime';
import { getTelemetryService, setTelemetryService } from './telemetry/telemetry';

/** Internal-only activation error; never crosses the bundle boundary (activate() rejects via runPromise on failure). */
class TelemetryUnavailableError extends Schema.TaggedError<TelemetryUnavailableError>()('TelemetryUnavailableError', {
  message: Schema.String
}) {}

export const activate = async (context: vscode.ExtensionContext) => {
  setAllServicesLayer(buildAllServicesLayer(context, nls.localize('channel_name')));
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
  if (!telemetryService) {
    return yield* new TelemetryUnavailableError({ message: 'Could not fetch a telemetry service instance' });
  }
  yield* Effect.promise(() => telemetryService.initializeService(context));
  setTelemetryService(telemetryService);

  // fails with the typed NoWorkspaceOpenError from WorkspaceService when no workspace is open
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* (yield* api.services.WorkspaceService).getWorkspaceInfoOrThrow();

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

  // Resolve any found orphan language servers in the background on the extension scope
  // (replaces the former blocking execSync-in-setImmediate path that froze the Windows host).
  const scope = yield* getExtensionScope();
  yield* Effect.forkIn(checkAndResolveOrphanedLanguageServers(), scope).pipe(Effect.asVoid);
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
  languageClientManager.disposeOutputChannel();
  getTelemetryService().sendExtensionDeactivationEvent();
  // Close the extension scope so the forked orphan-check fiber does not outlive deactivation.
  await getRuntime().runPromise(closeExtensionScope());
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
