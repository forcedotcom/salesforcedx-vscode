/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

type Json = string | number | boolean | null | readonly Json[] | JsonMap;

/**
 * JSON object. Values include `undefined` because a list of rows with different keys
 * is typed with `?: undefined` for the keys a row omits. `Schema.Record` does not have a
 * JSON value schema that excludes that and still accepts those rows.
 */
export type JsonMap = { readonly [key: string]: Json | undefined };

const Json: Schema.Schema<Json> = Schema.suspend(() =>
  Schema.Union(Schema.String, Schema.JsonNumber, Schema.Boolean, Schema.Null, Schema.Array(Json), JsonMap)
);

export const JsonMap: Schema.Schema<JsonMap> = Schema.Record({
  key: Schema.String,
  value: Schema.UndefinedOr(Json)
});
