/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { buildAllServicesLayer, closeExtensionScope, ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import {
  addAnonymousApexCellCommand,
  addSoqlCellCommand,
  createSoqlNotebookCommand,
  toggleCellQueryPlanCommand,
  toggleCellToolingApiCommand
} from './commands/createSoqlNotebook';
import {
  sortNotebookByLastEditedCommand,
  sortNotebookByLastRunCommand,
  stampCellTimestamp
} from './commands/sortSoqlNotebook';
import { nls } from './messages';
import { registerSoqlNotebookController } from './notebookController';
import {
  LAST_EDITED_AT_METADATA,
  NOTEBOOK_TYPE,
  SoqlNotebookSerializer
} from './notebookSerializer';
import { setAllServicesLayer } from './services/extensionProvider';
import { disposeRuntime, getRuntime } from './services/runtime';
import { SoqlCellOptionsStatusBarProvider, syncStaleResultOutputs } from './toolingApiStatusBar';

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  setAllServicesLayer(buildAllServicesLayer(context, nls.localize('channel_name')));
  await getRuntime().runPromise(activateEffect(context));
};

export const deactivate = async (): Promise<void> => {
  await getRuntime().runPromise(deactivation()).finally(disposeRuntime);
};

const activateEffect = Effect.fn('activation:salesforcedx-vscode-notebook')(function* (
  context: vscode.ExtensionContext
) {
  const controller = registerSoqlNotebookController();
  const statusBarProvider = new SoqlCellOptionsStatusBarProvider();
  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer(NOTEBOOK_TYPE, new SoqlNotebookSerializer()),
    vscode.notebooks.registerNotebookCellStatusBarItemProvider(NOTEBOOK_TYPE, statusBarProvider),
    controller,
    vscode.workspace.onDidOpenNotebookDocument(notebook => {
      if (notebook.notebookType === NOTEBOOK_TYPE) {
        void syncStaleResultOutputs(notebook, controller);
      }
    }),
    vscode.workspace.onDidChangeNotebookDocument(event => {
      if (event.notebook.notebookType !== NOTEBOOK_TYPE) {
        return;
      }
      event.cellChanges.forEach(change => {
        if (change.document === undefined || change.cell.kind !== vscode.NotebookCellKind.Code) {
          return;
        }
        void vscode.workspace.applyEdit(stampCellTimestamp(event.notebook, change.cell, LAST_EDITED_AT_METADATA));
      });
      void syncStaleResultOutputs(event.notebook, controller);
    })
  );
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const registerCommand = api.services.registerCommandWithRuntime(getRuntime());
  yield* registerCommand('salesforcedx-vscode-notebook.create', createSoqlNotebookCommand);
  yield* registerCommand('salesforcedx-vscode-notebook.addSoqlCell', addSoqlCellCommand);
  yield* registerCommand('salesforcedx-vscode-notebook.addAnonymousApexCell', addAnonymousApexCellCommand);
  yield* registerCommand('salesforcedx-vscode-notebook.toggleToolingApi', toggleCellToolingApiCommand);
  yield* registerCommand('salesforcedx-vscode-notebook.toggleQueryPlan', toggleCellQueryPlanCommand);
  yield* registerCommand('salesforcedx-vscode-notebook.sortByLastEdited', sortNotebookByLastEditedCommand);
  yield* registerCommand('salesforcedx-vscode-notebook.sortByLastRun', sortNotebookByLastRunCommand);
});

const deactivation = Effect.fn('deactivation')(function* () {
  yield* closeExtensionScope();
});
