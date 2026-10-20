/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { nls } from './messages';
import { INCLUDE_QUERY_PLAN_METADATA, USE_TOOLING_API_METADATA } from './notebookSerializer';

export const cellUsesToolingApi = (cell: { metadata?: { [key: string]: unknown } }): boolean =>
  cell.metadata?.[USE_TOOLING_API_METADATA] === true;

export const cellIncludesQueryPlan = (cell: { metadata?: { [key: string]: unknown } }): boolean =>
  cell.metadata?.[INCLUDE_QUERY_PLAN_METADATA] === true;

export const nextBooleanMetadata = (
  metadata: { [key: string]: unknown } | undefined,
  key: string,
  enabled: boolean
): { [key: string]: unknown } => ({
  ...metadata,
  [key]: enabled
});

export const resolveToggleTargetCells = (
  notebook: vscode.NotebookDocument,
  selections: readonly vscode.NotebookRange[],
  explicitCell?: vscode.NotebookCell
): vscode.NotebookCell[] => {
  if (explicitCell?.kind === vscode.NotebookCellKind.Code) {
    return [explicitCell];
  }
  return selections.flatMap(range =>
    notebook.getCells(range).filter(cell => cell.kind === vscode.NotebookCellKind.Code)
  );
};

export const createUntitledSoqlNotebookData = (): vscode.NotebookData =>
  new vscode.NotebookData([
    new vscode.NotebookCellData(vscode.NotebookCellKind.Markup, nls.localize('notebook_intro'), 'markdown'),
    new vscode.NotebookCellData(vscode.NotebookCellKind.Code, '', 'soql')
  ]);
