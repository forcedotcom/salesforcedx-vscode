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
import { checkAndResolveOrphanedLanguageServers } from './languageServerOrphanHandler';
import {
  configureApexLanguage,
  getExceptionBreakpointInfo,
  getLineBreakpointInfo,
  languageClientManager,
  restartLanguageServerAndClient,
  createLanguageClient
} from './languageUtils';
import { nls } from './messages';
import { setAllServicesLayer } from './services/extensionProvider';
import { disposeRuntime, getRuntime } from './services/runtime';

export const activate = async (context: vscode.ExtensionContext) => {
  setAllServicesLayer(buildAllServicesLayer(context, nls.localize('channel_name')));
  await getRuntime().runPromise(activateEffect(context));
  return {
    getLineBreakpointInfo,
    getExceptionBreakpointInfo,
    languageClientManager
  };
};

export const activateEffect = Effect.fn('activation:salesforcedx-vscode-apex')(function* (
  context: vscode.ExtensionContext
) {
  // fails with the typed NoWorkspaceOpenError from WorkspaceService when no workspace is open
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* (yield* api.services.WorkspaceService).getWorkspaceInfoOrThrow();

  const isSalesforceProject = yield* api.services.ProjectService.isSalesforceProject();

  if (!isSalesforceProject) {
    return;
  }

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
  // `ensuring` runs teardown (disposeOutputChannel + closeExtensionScope) even if stop() rejects, so
  // the client child scope closes and the apex.lsp.client span flushes. `tryPromise`+`ignore`: surface
  // the rejection then swallow it so deactivate() still resolves.
  yield* Effect.tryPromise(() => languageClientManager.getClientInstance()?.stop(30_000) ?? Promise.resolve()).pipe(
    Effect.ensuring(
      Effect.sync(() => languageClientManager.disposeOutputChannel()).pipe(Effect.zipRight(closeExtensionScope()))
    ),
    Effect.ignore
  );
});

export const deactivate = async () => {
  await getRuntime().runPromise(deactivation());
  // Dispose AFTER deactivation resolves (spans ended): closing the runtime scope runs the NodeSdk
  // finalizer (forceFlush → shutdown) so ended spans export instead of being dropped by the
  // BatchSpanProcessor's UNREF'd 5s timer on reload/teardown.
  await disposeRuntime();
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
  languageClientManager: typeof languageClientManager;
};
