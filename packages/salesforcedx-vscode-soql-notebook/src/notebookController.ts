/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from './messages';
import { stampCellTimestamp } from './commands/sortSoqlNotebook';
import { INCLUDE_QUERY_PLAN_METADATA, LAST_RUN_AT_METADATA, NOTEBOOK_TYPE, USE_TOOLING_API_METADATA } from './notebookSerializer';
import { nextBooleanMetadata } from './soqlNotebookCells';
import { runSoqlCellQueryPlan } from './queryPlanRunner';
import {
  QUERY_PLAN_MIME,
  QUERY_RESULT_MIME,
  QueryPlanViewModel,
  QueryResultPayload,
  QueryResultViewModel
} from './queryResultOutput';
import { toQueryResultViewModel } from './queryResultViewModel';
import { getMaxQueryLimit, QueryApi, runSoqlCellQuery } from './queryRunner';
import { getRuntime } from './services/runtime';

export type CellLike = {
  document: { getText: () => string };
  kind?: number;
  documentLanguageId?: string;
  useToolingApi?: boolean;
  includeQueryPlan?: boolean;
};

export type CellExecutionLike = {
  start: (time?: number) => void;
  end: (success: boolean) => void;
  replaceOutput: (output: unknown) => void | Promise<void>;
  token: { isCancellationRequested: boolean };
};

export type ExecuteCellDeps = {
  runQuery: (text: string, api: QueryApi) => Promise<QueryResultPayload>;
  runQueryPlan?: (text: string) => Promise<QueryPlanViewModel>;
  createExecution: (cell: CellLike) => CellExecutionLike;
  clearQueryPlanRequest?: (cell: CellLike) => Promise<void>;
  markRan?: (cell: CellLike) => Promise<void>;
};

type FallbackOutputItem =
  | { mime: typeof QUERY_RESULT_MIME; data: QueryResultViewModel }
  | { mime: typeof QUERY_PLAN_MIME; data: QueryPlanViewModel }
  | { mime: 'application/vnd.code.notebook.stderr'; text: string };

type FallbackOutput = { items: FallbackOutputItem[] };

const hasNotebookOutputApi = (): boolean =>
  typeof vscode.NotebookCellOutput === 'function' &&
  typeof vscode.NotebookCellOutputItem?.json === 'function' &&
  typeof vscode.NotebookCellOutputItem?.error === 'function';

const toNotebookOrFallback = (
  items: FallbackOutputItem[]
): vscode.NotebookCellOutput | FallbackOutput => {
  if (!hasNotebookOutputApi()) {
    return { items };
  }
  return new vscode.NotebookCellOutput(
    items.map(item =>
      item.mime === 'application/vnd.code.notebook.stderr'
        ? vscode.NotebookCellOutputItem.stderr(item.text)
        : vscode.NotebookCellOutputItem.json(item.data, item.mime)
    )
  );
};

const buildSuccessOutputs = (
  queryResult: QueryResultViewModel,
  queryPlan?: QueryPlanViewModel
): Array<vscode.NotebookCellOutput | FallbackOutput> => {
  const outputs = [toNotebookOrFallback([{ mime: QUERY_RESULT_MIME, data: queryResult }])];
  if (queryPlan) {
    outputs.push(toNotebookOrFallback([{ mime: QUERY_PLAN_MIME, data: queryPlan }]));
  }
  return outputs;
};

const buildErrorOutput = (error: Error): vscode.NotebookCellOutput | FallbackOutput =>
  toNotebookOrFallback([{ mime: 'application/vnd.code.notebook.stderr', text: error.message }]);

export const shouldExecuteCell = (cell: CellLike): boolean =>
  cell.kind === (vscode.NotebookCellKind?.Code ?? 2) && cell.documentLanguageId === 'soql';

export const cellQueryApi = (cell: CellLike): QueryApi => (cell.useToolingApi === true ? 'tooling' : 'rest');

export const executeSoqlNotebookCell = async (cell: CellLike, deps: ExecuteCellDeps): Promise<void> => {
  const execution = deps.createExecution(cell);
  let success = false;
  try {
    execution.start(Date.now());
    if (execution.token.isCancellationRequested) {
      return;
    }

    const queryText = cell.document.getText();
    const payload = await deps.runQuery(queryText, cellQueryApi(cell));
    const queryPlan =
      cell.includeQueryPlan === true && deps.runQueryPlan ? await deps.runQueryPlan(queryText) : undefined;
    if (execution.token.isCancellationRequested) {
      return;
    }

    await execution.replaceOutput(buildSuccessOutputs(toQueryResultViewModel(queryText, payload), queryPlan));
    if (deps.markRan) {
      await deps.markRan(cell);
    }
    if (queryPlan && deps.clearQueryPlanRequest) {
      await deps.clearQueryPlanRequest(cell);
    }
    success = true;
  } catch (error) {
    if (!execution.token.isCancellationRequested) {
      await execution.replaceOutput(buildErrorOutput(error instanceof Error ? error : new Error(String(error))));
    }
  } finally {
    execution.end(success);
  }
};

const toCellLike = (cell: vscode.NotebookCell): CellLike => ({
  document: { getText: () => cell.document.getText() },
  kind: cell.kind,
  documentLanguageId: cell.document.languageId,
  useToolingApi: cell.metadata?.[USE_TOOLING_API_METADATA] === true,
  includeQueryPlan: cell.metadata?.[INCLUDE_QUERY_PLAN_METADATA] === true
});

const getConnection = async () => {
  const connection = await getRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      return yield* api.services.ConnectionService.getConnection();
    })
  );
  const toPayload = (result: { totalSize: number; done: boolean; records: unknown[] }): QueryResultPayload => ({
    totalSize: result.totalSize,
    done: result.done,
    records: result.records
  });
  return {
    query: async (soql: string, options: { autoFetch: boolean; maxFetch: number; scanAll: boolean }) =>
      toPayload(await connection.query(soql, options)),
    toolingQuery: async (soql: string, options: { autoFetch: boolean; maxFetch: number; scanAll: boolean }) =>
      toPayload(await connection.tooling.query(soql, options)),
    explain: async (soql: string) => {
      const result: unknown = await connection.request(`/query?explain=${encodeURIComponent(soql)}`);
      return result && typeof result === 'object' ? result : {};
    }
  };
};

export const registerSoqlNotebookController = (): vscode.NotebookController => {
  const controller = vscode.notebooks.createNotebookController(
    'salesforcedx-vscode-soql-notebook',
    NOTEBOOK_TYPE,
    nls.localize('channel_name')
  );
  controller.supportedLanguages = ['soql'];
  controller.executeHandler = async cells => {
    await Promise.all(
      cells
        .map(cell => ({ cell, cellLike: toCellLike(cell) }))
        .filter(({ cellLike }) => shouldExecuteCell(cellLike))
        .map(({ cell, cellLike }) =>
          executeSoqlNotebookCell(cellLike, {
            runQuery: (text, api) => runSoqlCellQuery(text, api, { getConnection, getMaxQueryLimit }),
            runQueryPlan: text => getConnection().then(connection => runSoqlCellQueryPlan(text, connection)),
            markRan: async () => {
              await vscode.workspace.applyEdit(stampCellTimestamp(cell.notebook, cell, LAST_RUN_AT_METADATA));
            },
            clearQueryPlanRequest: async () => {
              const edit = new vscode.WorkspaceEdit();
              edit.set(cell.notebook.uri, [
                vscode.NotebookEdit.updateCellMetadata(
                  cell.index,
                  nextBooleanMetadata(cell.metadata, INCLUDE_QUERY_PLAN_METADATA, false)
                )
              ]);
              await vscode.workspace.applyEdit(edit);
            },
            createExecution: () => {
              const execution = controller.createNotebookCellExecution(cell);
              return {
                start: time => execution.start(time),
                end: success => execution.end(success),
                replaceOutput: async output => {
                  const outputs = Array.isArray(output) ? output : [output];
                  const notebookOutputs = outputs.filter(item => item instanceof vscode.NotebookCellOutput);
                  if (notebookOutputs.length > 0) {
                    await execution.replaceOutput(notebookOutputs);
                  }
                },
                token: execution.token
              };
            }
          })
        )
    );
  };
  return controller;
};
