/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { NOTEBOOK_TYPE } from '../notebookSerializer';
import { cellMovesForSortedGroups, groupSoqlPairs, LAST_EDITED_AT_METADATA, LAST_RUN_AT_METADATA, RecencySortKey, withTimestamp } from '../notebookSort';

export const applyRecencySort = async (editor: vscode.NotebookEditor, key: RecencySortKey): Promise<void> => {
  const cells = editor.notebook.getCells();
  const moves = cellMovesForSortedGroups(
    groupSoqlPairs(
      cells.map((cell, index) => ({ index, kind: cell.kind, metadata: cell.metadata })),
      key
    )
  );
  for (const move of moves) {
    editor.selections = [new vscode.NotebookRange(move.from, move.from + move.count)];
    const command = move.to > move.from ? 'notebook.cell.moveDown' : 'notebook.cell.moveUp';
    const steps = Math.abs(move.to - move.from);
    for (let step = 0; step < steps; step += 1) {
      await vscode.commands.executeCommand(command);
    }
  }
};

export const stampCellTimestamp = (
  notebook: vscode.NotebookDocument,
  cell: vscode.NotebookCell,
  key: RecencySortKey,
  timestamp = Date.now()
): vscode.WorkspaceEdit => {
  const edit = new vscode.WorkspaceEdit();
  edit.set(notebook.uri, [
    vscode.NotebookEdit.updateCellMetadata(cell.index, withTimestamp(cell.metadata, key, timestamp))
  ]);
  return edit;
};

export const sortNotebookByLastEditedCommand = Effect.fn('sortNotebookByLastEditedCommand')(function* () {
  const editor = vscode.window.activeNotebookEditor;
  if (editor?.notebook.notebookType !== NOTEBOOK_TYPE) {
    return;
  }
  yield* Effect.promise(() => applyRecencySort(editor, LAST_EDITED_AT_METADATA));
});

export const sortNotebookByLastRunCommand = Effect.fn('sortNotebookByLastRunCommand')(function* () {
  const editor = vscode.window.activeNotebookEditor;
  if (editor?.notebook.notebookType !== NOTEBOOK_TYPE) {
    return;
  }
  yield* Effect.promise(() => applyRecencySort(editor, LAST_RUN_AT_METADATA));
});
