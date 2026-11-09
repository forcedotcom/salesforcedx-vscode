/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export const RecordSaveResultSchema = <A, I, R>(idSchema: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    success: Schema.Boolean,
    id: Schema.optional(idSchema),
    errors: Schema.Unknown.pipe(Schema.Array, Schema.optional)
  });
