/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isError } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

/** Formatting or generating an Apex report failed. */
export class ApexReportError extends Schema.TaggedError<ApexReportError>()('ApexReportError', {
  format: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.String)
<<<<<<< HEAD
};

/** A request made by an Apex operation failed. */
export class ApexOperationError extends Schema.TaggedError<ApexOperationError>()(
  'ApexOperationError',
  OperationErrorFields
) {}

/** An Apex operation received a response that did not match its public schema. */
export class ApexResponseDecodeError extends Schema.TaggedError<ApexResponseDecodeError>()(
  'ApexResponseDecodeError',
  OperationErrorFields
) {}

/** Formatting or generating an Apex report failed. */
export class ApexReportError extends Schema.TaggedError<ApexReportError>()('ApexReportError', {
  format: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.String)
}) {}

const AnonymousExecutionErrorFields = {
  operation: Schema.NonEmptyTrimmedString,
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
=======
>>>>>>> origin/sm/W-23839447
}) {}

/** Produces the serializable cause carried by public operation errors. */
export const causeMessage = (cause: unknown): string => (isError(cause) ? cause.message : String(cause));
