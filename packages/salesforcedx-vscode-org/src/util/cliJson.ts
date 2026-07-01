/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

/** Parses sf-CLI stdout JSON into a plain object so a discriminant can be injected before a tagged-union decode. */
export const CliRawObject = Schema.parseJson(Schema.Record({ key: Schema.String, value: Schema.Unknown }));

type CliRawObject = Schema.Schema.Type<typeof CliRawObject>;

/**
 * Shared decode pipeline for sf-CLI JSON responses that lack a `_tag`. Parses stdout to a plain object,
 * injects the discriminant `_tag` via `discriminate`, decodes the tagged union, and maps any decode/parse
 * failure to the caller's tagged error. Downstream dispatch is on `_tag` via `Match`.
 */
export const decodeTaggedCliResponse =
  <A, I extends { readonly _tag: string }>(union: Schema.Schema<A, I>, discriminate: (raw: CliRawObject) => string) =>
  <E>(onError: () => E) =>
  (stdout: string): Effect.Effect<A, E> =>
    Schema.decodeUnknown(CliRawObject)(stdout).pipe(
      Effect.map(raw => ({ ...raw, _tag: discriminate(raw) })),
      Effect.flatMap(tagged => Schema.decodeUnknown(union)(tagged)),
      Effect.mapError(onError)
    );
