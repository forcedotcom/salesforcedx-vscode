/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as soqlComments from '@salesforce/soql-common/soqlComments';
import type { JsonMap } from '@salesforce/ts-types';
import * as Effect from 'effect/Effect';
import { isError, isRecord } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { stripAllRows } from './allRows';

const hasMessage = (obj: unknown): obj is { message: unknown } => isRecord(obj) && 'message' in obj;

const getErrorMessage = (error: unknown): string =>
  isError(error) ? error.message : hasMessage(error) ? String(error.message) : String(error);

const JsonMapSchema = Schema.declare((input): input is JsonMap => isRecord(input));

export const runQuery = Effect.fn('runQuery')(function* (
  queryText: string,
  options: { showErrors?: boolean; maxRows?: number } = { showErrors: true }
) {
  const { maxRows } = options;
  const pureSOQLText = soqlComments.parseHeaderComments(queryText).soqlText;
  const { soql, scanAll } = stripAllRows(pureSOQLText);
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const queryService = yield* api.services.QueryService;

  return yield* queryService.query({ soql, scanAll }, JsonMapSchema).pipe(
    Effect.flatMap(({ totalSize, records }) =>
      records.pipe(
        Stream.take(maxRows ?? 50_000),
        Stream.runCollect,
        Effect.map(collectedRecords => {
          const flattenedRecords = flattenQueryRecords(Array.from(collectedRecords));
          return {
            totalSize,
            done: flattenedRecords.length >= totalSize,
            records: flattenedRecords
          };
        })
      )
    ),
    Effect.tapError(error =>
      options.showErrors
        ? Effect.sync(() => {
            void vscode.window.showErrorMessage(nls.localize('error_run_soql_query', getErrorMessage(error)));
          })
        : Effect.void
    )
  );
});
/**
  As query complexity grows
  we will need to flatten the results of nested values
  in order to be parsed and displayed correctly
 */
const flattenQueryRecords = (rawQueryRecords: JsonMap[]) =>
  // filter out the attributes key
  rawQueryRecords.map(({ attributes, ...cleanRecords }) => cleanRecords);
