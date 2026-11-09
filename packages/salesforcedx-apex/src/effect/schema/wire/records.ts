/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export const RecordSaveResultSchema = <A, I, R>(idSchema: Schema.Schema<A, I, R>) =>
  Schema.Union(
    Schema.Struct({
      success: Schema.Literal(true),
      id: idSchema,
      errors: Schema.Array(Schema.Unknown)
    }),
    Schema.Struct({
      success: Schema.Literal(false),
      id: Schema.optional(idSchema),
      errors: Schema.NonEmptyArray(Schema.Unknown)
    })
  );
