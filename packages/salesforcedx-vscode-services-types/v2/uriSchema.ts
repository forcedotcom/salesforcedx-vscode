/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';
import { URI } from 'vscode-uri';

// URI has a protected constructor; validate its supported structural identity rather than instanceof.
export const UriSchema = Schema.declare((value): value is URI => URI.isUri(value)).annotate({
  identifier: 'URI',
  description: 'vscode-uri URI'
});
/** JSON-safe URI codec; its decoded value remains the native vscode-uri instance. */
export const DocumentUriSchema = Schema.String.pipe(
  Schema.decodeTo(UriSchema, {
    decode: SchemaGetter.transform(value => URI.parse(value)),
    encode: SchemaGetter.transform(uri => uri.toString())
  })
);
export type DocumentUri = typeof DocumentUriSchema.Type;
