/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/** Apex source selected by the caller; file and terminal input belong to the host. */
export const ExecuteAnonymousOptionsSchema = Schema.Struct({ apexCode: Schema.String }).annotations({
  identifier: 'ExecuteAnonymousOptions'
});
export type ExecuteAnonymousOptions = typeof ExecuteAnonymousOptionsSchema.Type;

/** Successful execution returned to callers, excluding SOAP-only sentinel fields. */
export const ExecuteAnonymousOutcomeSchema = Schema.Struct({
  compiled: Schema.Literal(true),
  success: Schema.Literal(true),
  logBody: Schema.optional(Schema.String)
}).annotations({ identifier: 'ExecuteAnonymousOutcome' });
export type ExecuteAnonymousOutcome = typeof ExecuteAnonymousOutcomeSchema.Type;
