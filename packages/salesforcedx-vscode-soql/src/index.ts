/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { closeExtensionScope, ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { dataQuery, dataQueryDocument } from './commands/dataQuery';
import { queryPlan, queryPlanDocument } from './commands/queryPlan';
import { soqlBuilderToggle } from './commands/soqlBuilderToggle';
import { registerSoqlCodeLensProvider } from './commands/soqlCodeLensProvider';
import { soqlOpenNewBuilder, soqlOpenNewTextEditor } from './commands/soqlFileCreate';
import { SOQLEditorProvider } from './editor/soqlEditorProvider';
import { startLanguageClient, stopLanguageClient } from './lspClient/client';
import { QueryDataViewService } from './queryDataView/queryDataViewService';
import {
  AllServicesLayer,
  buildAllServicesLayer,
  getSoqlRuntime,
  setAllServicesLayer
} from './services/extensionProvider';

const EXTENSION_NAME = 'salesforcedx-vscode-soql';

export const activate = async (extensionContext: vscode.ExtensionContext): Promise<void> => {
  const extensionScope = Effect.runSync(getExtensionScope());
  setAllServicesLayer(buildAllServicesLayer(extensionContext));
  await Effect.runPromise(
    activateEffect(extensionContext).pipe(Effect.provide(AllServicesLayer), Scope.extend(extensionScope))
  );
};

export const deactivate = async (): Promise<void> => getSoqlRuntime().runPromise(deactivateEffect());

export const activateEffect = Effect.fn(`activation:${EXTENSION_NAME}`)(function* (context: vscode.ExtensionContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* svc.appendToChannel(`SOQL Extension Initializing in mode ${context.extensionMode}`);

  yield* Effect.sync(() => {
    context.subscriptions.push(SOQLEditorProvider.register(context));
    QueryDataViewService.register(context);
    registerSoqlCodeLensProvider(context);
  });

  const registerCommand = api.services.registerCommandWithRuntime(getSoqlRuntime());
  yield* Effect.all(
    [
      registerCommand('soql.open.new.builder', soqlOpenNewBuilder),
      registerCommand('soql.open.new.text.editor', soqlOpenNewTextEditor),
      registerCommand('soql.builder.toggle', soqlBuilderToggle),
      registerCommand('soql.walkthrough.open', () =>
        Effect.promise(() =>
          vscode.commands.executeCommand(
            'workbench.action.openWalkthrough',
            'salesforce.salesforcedx-vscode-soql#soqlWalkthrough',
            false
          )
        )
      ),
      registerCommand('sf.data.query.selection', dataQuery),
      registerCommand('sf.data.query.document', dataQueryDocument),
      registerCommand('sf.data.query.explain.selection', queryPlan),
      registerCommand('sf.data.query.explain.document', queryPlanDocument)
    ],
    { concurrency: 'unbounded' }
  );

  yield* Effect.promise(() => startLanguageClient(context));
  yield* svc.appendToChannel('SOQL Extension Activated');
});

export const deactivateEffect = Effect.fn(`deactivation:${EXTENSION_NAME}`)(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* closeExtensionScope();
  yield* Effect.promise(() => stopLanguageClient() ?? Promise.resolve());
  yield* svc.appendToChannel('SOQL Extension Deactivated');
});
