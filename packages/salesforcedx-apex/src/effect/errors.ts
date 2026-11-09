/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getErrorMessage } from '@salesforce/salesforcedx-utils';
import * as Schema from 'effect/Schema';

const AnonymousExecutionErrorFields = {
  operation: Schema.NonEmptyString.check(Schema.isTrimmed()),
  message: Schema.String,
  line: Schema.Number,
  column: Schema.Number,
  logBody: Schema.optional(Schema.String)
};

/** Anonymous Apex compiled unsuccessfully; diagnostics remain on the error. */
export class ApexCompileError extends Schema.TaggedError<ApexCompileError>()('ApexCompileError', {
  ...AnonymousExecutionErrorFields,
  compileProblem: Schema.NullOr(Schema.String)
}) {}

/** Anonymous Apex compiled but failed during execution. */
export class ApexRuntimeError extends Schema.TaggedError<ApexRuntimeError>()('ApexRuntimeError', {
  ...AnonymousExecutionErrorFields,
  exceptionMessage: Schema.NullOr(Schema.String),
  exceptionStackTrace: Schema.NullOr(Schema.String)
}) {}

/** Formatting or generating an Apex report failed. */
export class ApexReportError extends Schema.TaggedError<ApexReportError>()('ApexReportError', {
  format: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.String)
}) {}

/** Produces the serializable cause carried by public operation errors. */
export const causeMessage = (cause: unknown): string => getErrorMessage(cause);
