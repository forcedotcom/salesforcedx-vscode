/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  buildAllServicesLayer,
  closeExtensionScope,
  ExtensionProviderService,
  getExtensionScope
} from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
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

  // Resolve any orphan language servers in the background on the extension scope.
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

// root: true → exports as a top-level span (not an orphaned child of any ambient span)
const deactivation = Effect.fn('apex.deactivation', { root: true })(function* () {
  // `ensuring` guarantees teardown (dispose + closeExtensionScope) runs even if stop() rejects —
  // otherwise the per-client child scope stays open and the long-lived apex.lsp.client span never
  // ends/flushes. tryPromise (not promise) surfaces a stop() rejection as a typed failure; `ignore`
  // then swallows it so deactivate() still resolves (teardown already happened).
  yield* Effect.tryPromise(() => languageClientManager.getClientInstance()?.stop(30_000) ?? Promise.resolve()).pipe(
    Effect.ensuring(
      Effect.sync(() => languageClientManager.disposeOutputChannel()).pipe(Effect.zipRight(closeExtensionScope()))
    ),
    Effect.ignore
  );
});

export const deactivate = async () => {
  await getRuntime().runPromise(deactivation());
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
