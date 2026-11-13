/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';

export const AppInsightsWebFilePayload = Schema.Struct({
  name: Schema.String,
  eventType: Schema.Literals(['event', 'errorEvent']),
  properties: Schema.Record(Schema.String, Schema.UndefinedOr(Schema.String)),
  measurements: Schema.Record(Schema.String, Schema.Number)
});
