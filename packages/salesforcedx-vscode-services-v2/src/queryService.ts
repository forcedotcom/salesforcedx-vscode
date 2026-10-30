/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ConnectionError } from './connectionService.js';
import type { OrgId } from './defaultOrgInfo.js';
import type { FieldError, InactiveOrgOperationError, SoqlError } from './errors.js';
import type { UnknownError } from 'effect/Cause';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as Schema from 'effect/Schema';
import type * as Stream from 'effect/Stream';

export type QueryOptions = {
  readonly soql: string;
  readonly tooling?: boolean;
  readonly scanAll?: boolean;
  readonly orgId?: OrgId;
};
export type QueryPageError = UnknownError | Schema.SchemaError | FieldError | SoqlError | InactiveOrgOperationError;
export type QueryServiceResult<S extends Schema.Constraint> = {
  readonly totalSize: number;
  readonly records: Stream.Stream<S['Type'], QueryPageError, S['DecodingServices']>;
};
export class QueryService extends Context.Service<
  QueryService,
  {
    readonly query: <S extends Schema.Constraint>(
      options: QueryOptions,
      recordSchema: S
    ) => Effect.Effect<QueryServiceResult<S>, ConnectionError | QueryPageError, S['DecodingServices']>;
  }
>()('@salesforce/vscode-services-v2/QueryService') {}
