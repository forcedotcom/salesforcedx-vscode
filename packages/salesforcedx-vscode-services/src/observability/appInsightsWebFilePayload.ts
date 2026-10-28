/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';

export const AppInsightsWebFilePayload = Schema.Struct({
  name: Schema.String,
  eventType: Schema.Literal('event', 'errorEvent'),
  properties: Schema.Record({ key: Schema.String, value: Schema.UndefinedOr(Schema.String) }),
  measurements: Schema.Record({ key: Schema.String, value: Schema.Number })
});
