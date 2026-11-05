/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Option from 'effect/Option';
import { isNotNull } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';

/** Existing Tooling optional fields accept null/undefined and omit null values after decoding. */
export const optionalToolingField = <S extends Schema.Top>(schema: S) =>
  schema.pipe(
    Schema.NullOr,
    Schema.optional,
    Schema.decodeTo(schema.pipe(Schema.toType, Schema.optional), {
      decode: SchemaGetter.transformOptional(Option.filter(isNotNull)),
      encode: SchemaGetter.transformOptional(value => value)
    })
  );
