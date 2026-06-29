/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';

/** Suite execution requested but no suite name could be resolved from the selected items. */
export class SuiteNameUnresolvedError extends Schema.TaggedError<SuiteNameUnresolvedError>()(
  'SuiteNameUnresolvedError',
  { message: Schema.String }
) {}

/** TestService.buildAsyncPayload produced no payload for the selected tests. */
export class PayloadBuildError extends Schema.TaggedError<PayloadBuildError>()('PayloadBuildError', {
  message: Schema.String
}) {}

/** Test results folder could not be determined (no workspace). */
export class TestTempFolderError extends Schema.TaggedError<TestTempFolderError>()('TestTempFolderError', {
  message: Schema.String
}) {}
