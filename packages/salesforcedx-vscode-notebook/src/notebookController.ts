/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { stampCellTimestamp } from './commands/sortSoqlNotebook';
import { nls } from './messages';
import {
  INCLUDE_QUERY_PLAN_METADATA,
  LAST_RUN_AT_METADATA,
  NOTEBOOK_TYPE,
  USE_TOOLING_API_METADATA
} from './notebookSerializer';
import { runSoqlCellQueryPlan, type QueryPlanConnection } from './queryPlanRunner';
import {
  ANONYMOUS_APEX_RESULT_MIME,
  QUERY_PLAN_MIME,
  QUERY_RESULT_MIME,
  type AnonymousApexResult,
  type QueryPlanViewModel,
  type QueryResultPayload,
  type QueryResultViewModel
} from './queryResultOutput';
import { toQueryResultViewModel } from './queryResultViewModel';
import { getMaxQueryLimit, type QueryApi, type QueryConnection, runSoqlCellQuery } from './queryRunner';
import { getRuntime } from './services/runtime';
import { nextBooleanMetadata } from './soqlNotebookCells';

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

export type ExecuteAnonymousApexDeps = {
  runAnonymousApex: (text: string) => Promise<{ result: AnonymousApexResult; logBody: string }>;
  createExecution: (cell: CellLike) => CellExecutionLike;
};

type FallbackOutputItem =
  | { mime: typeof ANONYMOUS_APEX_RESULT_MIME; data: AnonymousApexResult }
  | { mime: typeof QUERY_RESULT_MIME; data: QueryResultViewModel }
  | { mime: typeof QUERY_PLAN_MIME; data: QueryPlanViewModel }
  | { mime: 'application/vnd.code.notebook.stdout'; text: string }
  | { mime: 'application/vnd.code.notebook.stderr'; text: string };

type FallbackOutput = { items: FallbackOutputItem[] };

export const toCappedQueryResultPayload = (result: {
  totalSize: number;
  records: readonly unknown[];
}): QueryResultPayload => ({
  totalSize: result.totalSize,
  done: result.records.length >= result.totalSize,
  records: [...result.records]
});

type NotebookQueryOptions = { maxFetch: number; scanAll: boolean };

const runQuery = (soql: string, options: NotebookQueryOptions, tooling: boolean): Promise<QueryResultPayload> =>
  getRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const queryService = yield* api.services.QueryService;
      const result = yield* queryService.query({ soql, tooling, scanAll: options.scanAll }, Schema.Unknown);
      const records = yield* Stream.runCollect(result.records.pipe(Stream.take(options.maxFetch)));
      return toCappedQueryResultPayload({ totalSize: result.totalSize, records: Chunk.toReadonlyArray(records) });
    })
  );

const hasNotebookOutputApi = (): boolean =>
  typeof vscode.NotebookCellOutput === 'function' &&
  typeof vscode.NotebookCellOutputItem?.json === 'function' &&
  typeof vscode.NotebookCellOutputItem?.error === 'function';

const toNotebookOrFallback = (items: FallbackOutputItem[]): vscode.NotebookCellOutput | FallbackOutput => {
  if (!hasNotebookOutputApi()) {
    return { items };
  }
  return new vscode.NotebookCellOutput(
    items.map(item =>
      item.mime === 'application/vnd.code.notebook.stderr'
        ? vscode.NotebookCellOutputItem.stderr(item.text)
        : item.mime === 'application/vnd.code.notebook.stdout'
          ? vscode.NotebookCellOutputItem.stdout(item.text)
          : vscode.NotebookCellOutputItem.json(item.data, item.mime)
    )
  );
};

const buildSuccessOutputs = (
  queryResult: QueryResultViewModel,
  queryPlan?: QueryPlanViewModel
): (vscode.NotebookCellOutput | FallbackOutput)[] => {
  const outputs = [toNotebookOrFallback([{ mime: QUERY_RESULT_MIME, data: queryResult }])];
  if (queryPlan) {
    outputs.push(toNotebookOrFallback([{ mime: QUERY_PLAN_MIME, data: queryPlan }]));
  }
  return outputs;
};

const buildErrorOutput = (error: Error): vscode.NotebookCellOutput | FallbackOutput =>
  toNotebookOrFallback([{ mime: 'application/vnd.code.notebook.stderr', text: error.message }]);

export const shouldExecuteCell = (cell: CellLike): boolean =>
  cell.kind === (vscode.NotebookCellKind?.Code ?? 2) &&
  (cell.documentLanguageId === 'soql' || cell.documentLanguageId === 'apex-anon');

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

export const executeAnonymousApexNotebookCell = async (
  cell: CellLike,
  deps: ExecuteAnonymousApexDeps
): Promise<void> => {
  const execution = deps.createExecution(cell);
  let success = false;
  try {
    execution.start(Date.now());
    if (execution.token.isCancellationRequested) return;
    const { result, logBody } = await deps.runAnonymousApex(cell.document.getText());
    if (execution.token.isCancellationRequested) return;
    await execution.replaceOutput([
      toNotebookOrFallback([{ mime: ANONYMOUS_APEX_RESULT_MIME, data: result }]),
      ...(logBody === ''
        ? []
        : [toNotebookOrFallback([{ mime: 'application/vnd.code.notebook.stdout', text: logBody }])])
    ]);
    success = result.success;
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

const getConnection = (): Promise<QueryConnection & QueryPlanConnection> =>
  Promise.resolve({
    query: (soql: string, options: NotebookQueryOptions) => runQuery(soql, options, false),
    toolingQuery: (soql: string, options: NotebookQueryOptions) => runQuery(soql, options, true),
    explain: async (soql: string) => {
      const result: unknown = await getRuntime().runPromise(
        Effect.gen(function* () {
          const api = yield* (yield* ExtensionProviderService).getServicesApi;
          const connection = yield* api.services.ConnectionService.getConnection();
          return yield* Effect.promise(() => connection.request(`/query?explain=${encodeURIComponent(soql)}`));
        })
      );
      return result && typeof result === 'object' ? result : {};
    }
  });

const runAnonymousApex = (code: string): Promise<{ result: AnonymousApexResult; logBody: string }> =>
  getRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const { result, logBody } = yield* api.services.ExecuteAnonymousService.executeAndRetrieveLog(code);
      return { result, logBody };
    })
  );

export const registerSoqlNotebookController = (): vscode.NotebookController => {
  const controller = vscode.notebooks.createNotebookController(
    'salesforcedx-vscode-notebook',
    NOTEBOOK_TYPE,
    nls.localize('channel_name')
  );
  controller.supportedLanguages = ['soql', 'apex-anon'];
  controller.executeHandler = async cells => {
    for (const cell of cells) {
      const cellLike = toCellLike(cell);
      if (!shouldExecuteCell(cellLike)) continue;
      const createExecution = (): CellExecutionLike => {
        const execution = controller.createNotebookCellExecution(cell);
        return {
          start: time => execution.start(time),
          end: success => execution.end(success),
          replaceOutput: async output => {
            const outputs = Array.isArray(output) ? output : [output];
            const notebookOutputs = outputs.filter(item => item instanceof vscode.NotebookCellOutput);
            if (notebookOutputs.length > 0) await execution.replaceOutput(notebookOutputs);
          },
          token: execution.token
        };
      };
      if (cellLike.documentLanguageId === 'soql') {
        await executeSoqlNotebookCell(cellLike, {
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
          createExecution
        });
      } else {
        await executeAnonymousApexNotebookCell(cellLike, {
          runAnonymousApex,
          createExecution
        });
      }
    }
  };
  return controller;
};
