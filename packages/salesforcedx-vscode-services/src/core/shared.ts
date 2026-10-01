/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Org, Connection, ConfigAggregator } from '@salesforce/core';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import { isError } from 'effect/Predicate';

export class GetOrgFromConnectionError extends Data.TaggedError('GetOrgFromConnectionError')<{
  readonly cause: unknown;
}> {}

/** passing in a configAggregator is highly recommended to avoid sfdx-core creating a new one  */
export const getOrgFromConnection = (connection: Connection, aggregator?: ConfigAggregator) =>
  Effect.tryPromise({
    try: () => Org.create({ connection, aggregator }),
    catch: error => new GetOrgFromConnectionError({ cause: error })
  }).pipe(Effect.withSpan('Org.create'));

/** Normalize an unknown catch value to a real `Error` cause plus its `message`, so tagged errors that
 * spread this surface the underlying text instead of an empty message in pretty-printed output. */
export const unknownToErrorCause = (error: unknown): { cause: Error; message: string } => {
  const cause = isError(error) ? error : new Error(String(error));
  return { cause, message: cause.message };
};
