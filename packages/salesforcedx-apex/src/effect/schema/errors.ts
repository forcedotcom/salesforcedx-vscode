/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

const OperationErrorFields = {
  operation: Schema.NonEmptyTrimmedString,
  message: Schema.String,
  cause: Schema.optional(Schema.String)
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
}) {}

/** An execute-anonymous request failed with an invalid Salesforce session. */
export class InvalidSessionError extends Schema.TaggedError<InvalidSessionError>()('InvalidSessionError', {
  message: Schema.String
}) {}

/** An execute-anonymous request failed for a non-authentication reason. */
export class ApexRequestError extends Schema.TaggedError<ApexRequestError>()('ApexRequestError', {
  message: Schema.String
}) {}

export class ApexLogQueryError extends Schema.TaggedError<ApexLogQueryError>()('ApexLogQueryError', {
  soql: Schema.String,
  message: Schema.String,
  cause: Schema.Unknown
}) {}

export class ApexLogBodyFetchError extends Schema.TaggedError<ApexLogBodyFetchError>()('ApexLogBodyFetchError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}
