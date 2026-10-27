/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/** Generic SOQL response page; nonterminal pages require a continuation URL. */
export const QueryPageSchema = <A, I>(recordSchema: Schema.Schema<A, I, never>) => {
  const fields = {
    totalSize: Schema.Number,
    records: Schema.optionalWith(Schema.Array(recordSchema), { default: () => [] })
  };
  return Schema.Union(
    Schema.Struct({
      ...fields,
      done: Schema.optionalWith(Schema.Literal(true), { default: () => true as const }),
      nextRecordsUrl: Schema.optional(Schema.Never)
    }),
    Schema.Struct({
      ...fields,
      done: Schema.Literal(false),
      nextRecordsUrl: Schema.NonEmptyString
    })
  );
};
