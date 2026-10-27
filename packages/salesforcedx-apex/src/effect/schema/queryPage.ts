/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/** Generic SOQL response page; nonterminal pages require a continuation URL. */
export const QueryPageSchema = <A, I>(recordSchema: Schema.Schema<A, I, never>) =>
  Schema.Struct({
    totalSize: Schema.Number,
    done: Schema.optionalWith(Schema.Boolean, { default: () => true }),
    nextRecordsUrl: Schema.optional(Schema.NonEmptyString),
    records: Schema.optionalWith(Schema.Array(recordSchema), { default: () => [] })
  }).pipe(
    Schema.filter(
      page => page.done || page.nextRecordsUrl !== undefined || 'A continuing query page must include nextRecordsUrl'
    )
  );
