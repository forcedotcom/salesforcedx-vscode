/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

const ErrorFields = { message: Schema.String, cause: Schema.optional(Schema.String) };

export class VisualQaWorkspaceError extends Schema.TaggedError<VisualQaWorkspaceError>()(
  'VisualQaWorkspaceError',
  ErrorFields
) {}
export class VisualQaArtifactError extends Schema.TaggedError<VisualQaArtifactError>()(
  'VisualQaArtifactError',
  ErrorFields
) {}
export class VisualQaExtensionError extends Schema.TaggedError<VisualQaExtensionError>()(
  'VisualQaExtensionError',
  ErrorFields
) {}
export class VisualQaLaunchError extends Schema.TaggedError<VisualQaLaunchError>()(
  'VisualQaLaunchError',
  ErrorFields
) {}
export class VisualQaObservationError extends Schema.TaggedError<VisualQaObservationError>()(
  'VisualQaObservationError',
  ErrorFields
) {}
export class VisualQaActionError extends Schema.TaggedError<VisualQaActionError>()(
  'VisualQaActionError',
  ErrorFields
) {}
export class VisualQaTeardownError extends Schema.TaggedError<VisualQaTeardownError>()(
  'VisualQaTeardownError',
  ErrorFields
) {}
export class VisualQaMcpShutdownError extends Schema.TaggedError<VisualQaMcpShutdownError>()(
  'VisualQaMcpShutdownError',
  ErrorFields
) {}
export class VisualQaStateError extends Schema.TaggedError<VisualQaStateError>()('VisualQaStateError', {
  message: Schema.String,
  state: Schema.String
}) {}
export class VisualQaStaleObservationError extends Schema.TaggedError<VisualQaStaleObservationError>()(
  'VisualQaStaleObservationError',
  {
    message: Schema.String,
    requestedSequence: Schema.Number,
    latestSequence: Schema.Number
  }
) {}

export const causeMessage = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));
