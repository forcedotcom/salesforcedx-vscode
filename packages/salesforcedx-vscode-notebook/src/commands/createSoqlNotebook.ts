/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import {
  INCLUDE_QUERY_PLAN_METADATA,
  NOTEBOOK_TYPE,
  USE_TOOLING_API_METADATA
} from '../notebookSerializer';
import {
  cellIncludesQueryPlan,
  cellUsesToolingApi,
  createUntitledSoqlNotebookData,
  nextBooleanMetadata,
  resolveToggleTargetCells
} from '../soqlNotebookCells';

const toggleBooleanMetadata = (
  key: string,
  currentlyEnabled: (cell: vscode.NotebookCell) => boolean,
  explicitCell?: vscode.NotebookCell
) =>
  Effect.gen(function* () {
    const editor = vscode.window.activeNotebookEditor;
    if (editor?.notebook.notebookType !== NOTEBOOK_TYPE) {
      return;
    }

    const selected = resolveToggleTargetCells(editor.notebook, editor.selections, explicitCell).filter(
      cell => cell.document.languageId === 'soql'
    );
    if (selected.length === 0) {
      return;
    }

    const enable = selected.some(cell => !currentlyEnabled(cell));
    const edit = new vscode.WorkspaceEdit();
    edit.set(
      editor.notebook.uri,
      selected.map(cell =>
        vscode.NotebookEdit.updateCellMetadata(cell.index, nextBooleanMetadata(cell.metadata, key, enable))
      )
    );
    yield* Effect.promise(() => vscode.workspace.applyEdit(edit));
  });

export const toggleCellToolingApiCommand = Effect.fn('toggleCellToolingApiCommand')(function* (
  explicitCell?: vscode.NotebookCell
) {
  yield* toggleBooleanMetadata(USE_TOOLING_API_METADATA, cellUsesToolingApi, explicitCell);
});

export const toggleCellQueryPlanCommand = Effect.fn('toggleCellQueryPlanCommand')(function* (
  explicitCell?: vscode.NotebookCell
) {
  yield* toggleBooleanMetadata(INCLUDE_QUERY_PLAN_METADATA, cellIncludesQueryPlan, explicitCell);
});

export const createSoqlNotebookCommand = Effect.fn('createSoqlNotebookCommand')(function* () {
  const document = yield* Effect.promise(() =>
    vscode.workspace.openNotebookDocument(NOTEBOOK_TYPE, createUntitledSoqlNotebookData())
  );
  yield* Effect.promise(() => vscode.window.showNotebookDocument(document));
});

export const createCodeCell = (languageId: 'soql' | 'apex-anon'): vscode.NotebookCellData =>
  new vscode.NotebookCellData(vscode.NotebookCellKind.Code, '', languageId);

const addCodeCell = (languageId: 'soql' | 'apex-anon') =>
  Effect.gen(function* () {
    const editor = vscode.window.activeNotebookEditor;
    if (editor?.notebook.notebookType !== NOTEBOOK_TYPE) {
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    const index = editor.selections[0]?.end ?? editor.notebook.cellCount;
    edit.set(editor.notebook.uri, [vscode.NotebookEdit.insertCells(index, [createCodeCell(languageId)])]);
    yield* Effect.promise(() => vscode.workspace.applyEdit(edit));
  });

export const addSoqlCellCommand = Effect.fn('addSoqlCellCommand')(function* () {
  yield* addCodeCell('soql');
});

export const addAnonymousApexCellCommand = Effect.fn('addAnonymousApexCellCommand')(function* () {
  yield* addCodeCell('apex-anon');
});

export { createUntitledSoqlNotebookData } from '../soqlNotebookCells';
