/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isError } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

const ErrorFields = { message: Schema.String, cause: Schema.optional(Schema.String) };

export class DrivableVscodeWorkspaceError extends Schema.TaggedError<DrivableVscodeWorkspaceError>()(
  'DrivableVscodeWorkspaceError',
  ErrorFields
) {}
export class DrivableVscodeArtifactError extends Schema.TaggedError<DrivableVscodeArtifactError>()(
  'DrivableVscodeArtifactError',
  ErrorFields
) {}
export class DrivableVscodeExtensionError extends Schema.TaggedError<DrivableVscodeExtensionError>()(
  'DrivableVscodeExtensionError',
  ErrorFields
) {}
export class DrivableVscodeLaunchError extends Schema.TaggedError<DrivableVscodeLaunchError>()(
  'DrivableVscodeLaunchError',
  ErrorFields
) {}
export class DrivableVscodeObservationError extends Schema.TaggedError<DrivableVscodeObservationError>()(
  'DrivableVscodeObservationError',
  ErrorFields
) {}
export class DrivableVscodeActionError extends Schema.TaggedError<DrivableVscodeActionError>()(
  'DrivableVscodeActionError',
  ErrorFields
) {}
export class DrivableVscodeTeardownError extends Schema.TaggedError<DrivableVscodeTeardownError>()(
  'DrivableVscodeTeardownError',
  ErrorFields
) {}
export class DrivableVscodeMcpShutdownError extends Schema.TaggedError<DrivableVscodeMcpShutdownError>()(
  'DrivableVscodeMcpShutdownError',
  ErrorFields
) {}
export class DrivableVscodeStateError extends Schema.TaggedError<DrivableVscodeStateError>()(
  'DrivableVscodeStateError',
  {
    message: Schema.String,
    state: Schema.String
  }
) {}
export class DrivableVscodeStaleObservationError extends Schema.TaggedError<DrivableVscodeStaleObservationError>()(
  'DrivableVscodeStaleObservationError',
  {
    message: Schema.String,
    requestedSequence: Schema.Number,
    latestSequence: Schema.Number
  }
) {}

export const causeMessage = (cause: unknown): string => (isError(cause) ? cause.message : String(cause));
