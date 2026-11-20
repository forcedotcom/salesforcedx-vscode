/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export const LineBreakpointInfo = Schema.Struct({
  uri: Schema.String,
  typeref: Schema.String,
  lines: Schema.Array(Schema.Number)
});

export type LineBreakpointInfo = Schema.Schema.Type<typeof LineBreakpointInfo>;
