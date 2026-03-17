/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import { Column, ContinueResponse, createTable, Row, SfCommandlet } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { channelService } from '../services/channel';
import { getConnection } from '../services/org';
import { formatErrorMessage, GetDocumentQueryAndApiInputs, GetQueryAndApiInputs, QueryAndApiInputs } from './queryUtils';

type QueryPlanNote = {
  description: string;
  fields: string[];
  tableEnumOrId: string;
};

type QueryPlanEntry = {
  cardinality: number;
  fields: string[];
  leadingOperationType: string;
  notes: QueryPlanNote[];
  relativeCost: number;
  sobjectCardinality: number;
  sobjectType: string;
};

type QueryPlanResponse = {
  plans: QueryPlanEntry[];
};

export const formatQueryPlanResults = (response: QueryPlanResponse): string => {
  const { plans } = response;

  if (!plans?.length) {
    return nls.localize('query_plan_no_plans');
  }

  const columns: Column[] = [
    { key: 'cardinality', label: nls.localize('query_plan_col_cardinality') },
    { key: 'fields', label: nls.localize('query_plan_col_fields') },
    { key: 'leadingOperationType', label: nls.localize('query_plan_col_leading_op_type') },
    { key: 'relativeCost', label: nls.localize('query_plan_col_relative_cost') },
    { key: 'sobjectCardinality', label: nls.localize('query_plan_col_sobject_cardinality') },
    { key: 'sobjectType', label: nls.localize('query_plan_col_sobject_type') }
  ];

  const rows: Row[] = plans.map(plan => ({
    cardinality: String(plan.cardinality),
    fields: plan.fields.join(', '),
    leadingOperationType: plan.leadingOperationType,
    relativeCost: String(plan.relativeCost),
    sobjectCardinality: String(plan.sobjectCardinality),
    sobjectType: plan.sobjectType
  }));

  const table = createTable(rows, columns, nls.localize('query_plan_table_title'));

  const seenNotes = new Set<string>();
  const allNotes = plans.flatMap(plan => plan.notes ?? []).filter(note => {
    const key = `${note.description}|${note.tableEnumOrId}|${note.fields.join(',')}`;
    if (seenNotes.has(key)) {
      return false;
    }
    seenNotes.add(key);
    return true;
  });
  if (allNotes.length === 0) {
    return table;
  }

  const notesLines = allNotes.map(
    note =>
      `${nls.localize('query_plan_notes_description')}: ${note.description}\n${nls.localize('query_plan_notes_table')}: ${note.tableEnumOrId}\n${nls.localize('query_plan_notes_fields')}: ${note.fields.join(', ')}`
  );
  return `${table}\n${nls.localize('query_plan_notes_header')}:\n${notesLines.join('\n\n')}`;
};

class QueryPlanExecutor {
  public async execute(response: ContinueResponse<QueryAndApiInputs>): Promise<void> {
    if (vscode.workspace.getConfiguration('salesforcedx-vscode-core').get<boolean>('clearOutputTab', false)) {
      channelService.clear();
    }

    const { query, api } = response.data;

    try {
      const connection = await getConnection();
      channelService.appendLine(nls.localize('query_plan_running'));

      const apiVersion = connection.getApiVersion();
      const encodedQuery = encodeURIComponent(query);
      const path =
        api === 'TOOLING'
          ? `/services/data/v${apiVersion}/tooling/query?explain=${encodedQuery}`
          : `/services/data/v${apiVersion}/query?explain=${encodedQuery}`;

      const result = await connection.request<QueryPlanResponse>(path);
      channelService.appendLine(`\n${formatQueryPlanResults(result)}\n`);
      channelService.appendLine(nls.localize('query_plan_complete'));
    } catch (error) {
      channelService.appendLine(formatErrorMessage(error));
    } finally {
      channelService.show();
    }
  }
}

export const queryPlan = Effect.fn('sf.data.query.explain')(function* () {
  const commandlet = new SfCommandlet(sfProjectPreconditionChecker, new GetQueryAndApiInputs(), new QueryPlanExecutor());
  yield* Effect.promise(() => commandlet.run());
});

export const queryPlanDocument = Effect.fn('sf.data.query.explain.document')(function* () {
  const commandlet = new SfCommandlet(
    sfProjectPreconditionChecker,
    new GetDocumentQueryAndApiInputs(),
    new QueryPlanExecutor()
  );
  yield* Effect.promise(() => commandlet.run());
});
