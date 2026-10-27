/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

type QueryPageSchemaOptions<AdditionalFields extends Schema.Struct.Fields> = {
  readonly additionalFields?: AdditionalFields;
  readonly defaultTerminalPage?: boolean;
};

/** Builds the shared discriminated schema for a Salesforce query page. */
export const QueryPageSchema = <A, I, AdditionalFields extends Schema.Struct.Fields = {}>(
  recordSchema: Schema.Schema<A, I, never>,
  options: QueryPageSchemaOptions<AdditionalFields> = {}
) => {
  const fields = options.additionalFields ?? ({} as AdditionalFields);
  const records = Schema.Array(recordSchema);

  return Schema.Union(
    Schema.Struct({
      ...fields,
      done: options.defaultTerminalPage
        ? Schema.optionalWith(Schema.Literal(true), { default: () => true })
        : Schema.Literal(true),
      records: options.defaultTerminalPage ? Schema.optionalWith(records, { default: () => [] }) : records
    }),
    Schema.Struct({
      ...fields,
      done: Schema.Literal(false),
      records,
      nextRecordsUrl: Schema.NonEmptyString
    })
  );
};
