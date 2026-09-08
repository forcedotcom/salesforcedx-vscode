/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isError } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

const OperationErrorFields = {
  operation: Schema.NonEmptyTrimmedString,
  message: Schema.String,
  cause: Schema.optional(Schema.String)
};

/** A Salesforce connection could not be supplied to an Apex operation. */
export class ApexConnectionError extends Schema.TaggedError<ApexConnectionError>('ApexConnectionError')(
  'ApexConnectionError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.String)
  }
) {}

/** A request made by an Apex operation failed. */
export class ApexOperationError extends Schema.TaggedError<ApexOperationError>('ApexOperationError')(
  'ApexOperationError',
  OperationErrorFields
) {}

/** An Apex operation received a response that did not match its public schema. */
export class ApexResponseDecodeError extends Schema.TaggedError<ApexResponseDecodeError>('ApexResponseDecodeError')(
  'ApexResponseDecodeError',
  OperationErrorFields
) {}

/** Produces the serializable cause carried by public operation errors. */
export const causeMessage = (cause: unknown): string => (isError(cause) ? cause.message : String(cause));
