/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json | undefined };

const Json: Schema.Codec<Json> = Schema.suspend(() =>
  Schema.Union([
    Schema.String,
    Schema.Finite,
    Schema.Boolean,
    Schema.Null,
    Schema.Array(Json),
    Schema.Record(Schema.String, Schema.UndefinedOr(Json))
  ])
);

/** Index includes `undefined` so it accepts the streaming client's message object. */
export type JsonObject = { readonly [key: string]: typeof Json.Type | undefined };
