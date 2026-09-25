/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { QueryResult } from '../types';
import type { Connection } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as soqlComments from '@salesforce/soql-common/soqlComments';
import type { JsonMap } from '@salesforce/ts-types';
import * as Effect from 'effect/Effect';
import { isUndefined } from 'effect/Predicate';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { SoqlRecord } from '../soqlRecord';
import { stripAllRows } from './allRows';

export const runQuery = Effect.fn('runQuery')(function* (
  conn: Connection,
  queryText: string,
  options?: { readonly showErrors?: boolean; readonly maxRows?: number }
) {
  const showErrors = isUndefined(options) ? true : options.showErrors === true;
  const pureSOQLText = soqlComments.parseHeaderComments(queryText).soqlText;
  const { soql, scanAll } = stripAllRows(pureSOQLText);
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.QueryService.pipe(
    Effect.flatMap(queryService =>
      queryService.query(conn, { soql, scanAll, maxFetch: options?.maxRows ?? 50_000 }, SoqlRecord)
    ),
    Effect.map(
      (raw): QueryResult<JsonMap> => ({
        done: true,
        totalSize: raw.totalSize,
        records: flattenQueryRecords(raw.records ?? [])
      })
    ),
    Effect.tapError(error =>
      showErrors
        ? Effect.promise(() => vscode.window.showErrorMessage(nls.localize('error_run_soql_query', error.message)))
        : Effect.void
    )
  );
});
/**
  As query complexity grows
  we will need to flatten the results of nested values
  in order to be parsed and displayed correctly
 */
const flattenQueryRecords = (rawQueryRecords: readonly JsonMap[]) =>
  // filter out the attributes key
  rawQueryRecords.map(({ attributes, ...cleanRecords }) => cleanRecords);
