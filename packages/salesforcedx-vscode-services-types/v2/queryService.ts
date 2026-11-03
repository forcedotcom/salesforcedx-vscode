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
import type * as Stream from 'effect/Stream';

export type QueryOptions = {
  readonly soql: string;
  readonly tooling?: boolean;
  readonly scanAll?: boolean;
  readonly orgId?: OrgId;
};
export type QueryPageError = UnknownError | FieldError | SoqlError | InactiveOrgOperationError;
export type QueryPage<A> = {
  readonly totalSize: number;
  readonly done?: boolean;
  readonly nextRecordsUrl?: string;
  readonly records?: readonly A[];
};
export type QueryServiceResult<A, E = never, R = never> = {
  readonly totalSize: number;
  readonly records: Stream.Stream<A, QueryPageError | E, R>;
};
export class QueryService extends Context.Service<
  QueryService,
  {
    readonly query: <A, E, R>(
      options: QueryOptions,
      decodePage: (input: unknown) => Effect.Effect<QueryPage<A>, E, R>
    ) => Effect.Effect<QueryServiceResult<A, E, R>, ConnectionError | QueryPageError | E, R>;
  }
>()('@salesforce/vscode-services/v2/QueryService') {}
