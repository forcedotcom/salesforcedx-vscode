/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Column, createTable, getServicesApi, Row } from '@salesforce/effect-ext-utils';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { channelService } from '../services/channel';
import { formatErrorMessage, getDocumentQueryInputsForPlan, getQueryInputsForPlan } from './queryUtils';

const QueryPlanNote = Schema.Data(
  Schema.Struct({
    description: Schema.String,
    fields: Schema.Chunk(Schema.String),
    tableEnumOrId: Schema.String
  })
);

const QueryPlanEntry = Schema.Struct({
  cardinality: Schema.Number,
  fields: Schema.Array(Schema.String),
  leadingOperationType: Schema.String,
  notes: Schema.Array(QueryPlanNote),
  relativeCost: Schema.Number,
  sobjectCardinality: Schema.Number,
  sobjectType: Schema.String
});

export const QueryPlanResponse = Schema.Struct({
  plans: Schema.Array(QueryPlanEntry)
});

export const formatQueryPlanResults = (response: Schema.Schema.Type<typeof QueryPlanResponse>): string => {
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

  const allNotes = HashSet.fromIterable(plans.flatMap(plan => plan.notes ?? []));
  if (HashSet.size(allNotes) === 0) {
    return table;
  }

  const notesLines = HashSet.toValues(allNotes).map(
    note =>
      `${nls.localize('query_plan_notes_description')}: ${note.description}\n${nls.localize('query_plan_notes_table')}: ${note.tableEnumOrId}\n${nls.localize('query_plan_notes_fields')}: ${Chunk.toArray(note.fields).join(', ')}`
  );
  return `${table}\n${nls.localize('query_plan_notes_header')}:\n${notesLines.join('\n\n')}`;
};

const executeQueryPlan = Effect.fn('executeQueryPlan')(function* (query: string) {
  const servicesApi = yield* getServicesApi;
  if (vscode.workspace.getConfiguration('salesforcedx-vscode-core').get<boolean>('clearOutputTab', false)) {
    channelService.clear();
  }

  try {
    const connection = yield* servicesApi.services.ConnectionService.getConnection();
    channelService.appendLine(nls.localize('query_plan_running', nls.localize('REST_API')));

    const encodedQuery = encodeURIComponent(query);
    const path = `/query?explain=${encodedQuery}`;

    const result = yield* Effect.promise(() => connection.request(path)).pipe(
      Effect.flatMap(Schema.decodeUnknown(QueryPlanResponse))
    );
    channelService.appendLine(`\n${formatQueryPlanResults(result)}\n`);
    channelService.appendLine(nls.localize('query_plan_complete'));
  } catch (error) {
    channelService.appendLine(formatErrorMessage(error));
  } finally {
    channelService.show();
  }
});

export const queryPlan = Effect.fn('sf.data.query.explain')(function* () {
  const servicesApi = yield* getServicesApi;
  yield* servicesApi.services.ProjectService.isSalesforceProject().pipe(
    Effect.flatMap(isProject => (isProject ? Effect.void : Effect.fail(new Error('No Salesforce project found'))))
  );
  const inputs = yield* getQueryInputsForPlan();
  yield* executeQueryPlan(inputs);
});

export const queryPlanDocument = Effect.fn('sf.data.query.explain.document')(function* () {
  const servicesApi = yield* getServicesApi;
  yield* servicesApi.services.ProjectService.isSalesforceProject().pipe(
    Effect.flatMap(isProject => (isProject ? Effect.void : Effect.fail(new Error('No Salesforce project found'))))
  );
  const inputs = yield* getDocumentQueryInputsForPlan();
  yield* executeQueryPlan(inputs);
});
