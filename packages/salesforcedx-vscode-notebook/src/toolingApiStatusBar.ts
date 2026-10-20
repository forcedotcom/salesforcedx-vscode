/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { nls } from './messages';
import {
  INCLUDE_QUERY_PLAN_METADATA,
  NOTEBOOK_TYPE,
  USE_TOOLING_API_METADATA
} from './notebookSerializer';
import { isStaleQueryOutput, outputQueryText, payloadIsMarkedStale, withStaleFlag } from './queryFreshness';

export const TOGGLE_TOOLING_API_COMMAND = 'salesforcedx-vscode-notebook.toggleToolingApi';
export const TOGGLE_QUERY_PLAN_COMMAND = 'salesforcedx-vscode-notebook.toggleQueryPlan';

export const toolingStatusBarText = (useToolingApi: boolean): string =>
  useToolingApi ? nls.localize('tooling_api_checked') : nls.localize('tooling_api_unchecked');

export const queryPlanStatusBarText = (includeQueryPlan: boolean): string =>
  includeQueryPlan ? nls.localize('query_plan_checked') : nls.localize('query_plan_unchecked');

const checkboxItem = (
  text: string,
  command: string,
  tooltip: string,
  cell: vscode.NotebookCell,
  priority: number
): vscode.NotebookCellStatusBarItem => {
  const item = new vscode.NotebookCellStatusBarItem(text, vscode.NotebookCellStatusBarAlignment.Right);
  item.command = { command, title: tooltip, arguments: [cell] };
  item.tooltip = tooltip;
  item.priority = priority;
  item.accessibilityInformation = { label: tooltip, role: 'checkbox' };
  return item;
};

export const createToolingApiStatusBarItem = (cell: vscode.NotebookCell): vscode.NotebookCellStatusBarItem =>
  checkboxItem(
    toolingStatusBarText(cell.metadata?.[USE_TOOLING_API_METADATA] === true),
    TOGGLE_TOOLING_API_COMMAND,
    nls.localize('tooling_api_tooltip'),
    cell,
    20
  );

export const createQueryPlanStatusBarItem = (cell: vscode.NotebookCell): vscode.NotebookCellStatusBarItem =>
  checkboxItem(
    queryPlanStatusBarText(cell.metadata?.[INCLUDE_QUERY_PLAN_METADATA] === true),
    TOGGLE_QUERY_PLAN_COMMAND,
    nls.localize('query_plan_tooltip'),
    cell,
    10
  );

const decoder = new TextDecoder();

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const parseOutputItem = (item: vscode.NotebookCellOutputItem): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = JSON.parse(decoder.decode(item.data));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const cellHasStaleResults = (cell: vscode.NotebookCell): boolean => {
  const cellText = cell.document.getText();
  return cell.outputs.some(output =>
    output.items.some(item => isStaleQueryOutput(cellText, outputQueryText(parseOutputItem(item))))
  );
};

const isQueryBoundOutput = (value: Record<string, unknown> | undefined): value is Record<string, unknown> =>
  outputQueryText(value) !== undefined;

export const cellOutputsNeedStaleFlag = (cell: vscode.NotebookCell): boolean => {
  const stale = cellHasStaleResults(cell);
  return cell.outputs.some(output =>
    output.items.some(item => {
      const parsed = parseOutputItem(item);
      return isQueryBoundOutput(parsed) && payloadIsMarkedStale(parsed) !== stale;
    })
  );
};

export const outputsWithStaleFlag = (
  outputs: readonly vscode.NotebookCellOutput[],
  stale: boolean
): vscode.NotebookCellOutput[] =>
  outputs.map(
    output =>
      new vscode.NotebookCellOutput(
        output.items.map(item => {
          const parsed = parseOutputItem(item);
          return isQueryBoundOutput(parsed)
            ? vscode.NotebookCellOutputItem.json(withStaleFlag(parsed, stale), item.mime)
            : item;
        }),
        output.metadata
      )
  );

export const syncStaleResultOutputs = async (
  notebook: vscode.NotebookDocument,
  controller: vscode.NotebookController
): Promise<void> => {
  await Promise.all(
    notebook.getCells().map(async cell => {
      if (cell.kind !== vscode.NotebookCellKind.Code || !cellOutputsNeedStaleFlag(cell)) {
        return;
      }
      const execution = controller.createNotebookCellExecution(cell);
      execution.start();
      await execution.replaceOutput(outputsWithStaleFlag(cell.outputs, cellHasStaleResults(cell)));
      execution.end(true);
    })
  );
};

export const createStaleResultsStatusBarItem = (): vscode.NotebookCellStatusBarItem => {
  const item = new vscode.NotebookCellStatusBarItem(
    nls.localize('stale_results'),
    vscode.NotebookCellStatusBarAlignment.Left
  );
  item.tooltip = nls.localize('stale_results');
  item.priority = 100;
  return item;
};

export class SoqlCellOptionsStatusBarProvider implements vscode.NotebookCellStatusBarItemProvider {
  private readonly changeListeners = new Set<() => void>();

  public readonly onDidChangeCellStatusBarItems = (listener: () => void): vscode.Disposable => {
    this.changeListeners.add(listener);
    return { dispose: () => this.changeListeners.delete(listener) };
  };

  public refresh(): void {
    this.changeListeners.forEach(listener => listener());
  }

  public provideCellStatusBarItems(cell: vscode.NotebookCell): vscode.NotebookCellStatusBarItem[] | undefined {
    if (cell.kind !== vscode.NotebookCellKind.Code || cell.notebook.notebookType !== NOTEBOOK_TYPE) {
      return undefined;
    }
    const items: vscode.NotebookCellStatusBarItem[] = [];
    if (cell.document.languageId === 'soql') {
      items.push(createQueryPlanStatusBarItem(cell), createToolingApiStatusBarItem(cell));
    }
    if (cell.document.languageId === 'soql' && cellHasStaleResults(cell)) {
      items.unshift(createStaleResultsStatusBarItem());
    }
    return items;
  }
}
