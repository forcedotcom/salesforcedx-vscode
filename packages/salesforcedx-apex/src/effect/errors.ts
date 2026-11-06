/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import { isError } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

/** Formatting or generating an Apex report failed. */
export class ApexReportError extends Schema.TaggedError<ApexReportError>()('ApexReportError', {
  format: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.String)
}) {}

/** Produces the serializable cause carried by public operation errors. */
export const causeMessage = (cause: unknown): string => (isError(cause) ? cause.message : String(cause));

/** Synchronous compatibility adapter that preserves the typed report error. */
export const runReportSync = <A>(report: Effect.Effect<A, ApexReportError>): A =>
  report.pipe(
    Effect.either,
    Effect.runSync,
    Either.getOrThrowWith(error => error)
  );
