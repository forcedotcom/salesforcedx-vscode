/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Equal from 'effect/Equal';
import { dual } from 'effect/Function';
import * as Hash from 'effect/Hash';
import { isObject, isString } from 'effect/Predicate';
import type { URI } from 'vscode-uri';
import { comparisonPath } from './uriComparison.cjs';

/** V4 URI equality/hash value; retains structural cross-bundle URI comparison. */
export type HashableUri = {
  readonly uri: URI;
  readonly [Hash.symbol]: () => number;
  readonly [Equal.symbol]: (that: unknown) => boolean;
};

const isHashableUri = (value: unknown): value is HashableUri =>
  isObject(value) && isObject(value.uri) && isString(value.uri.scheme) && typeof value[Equal.symbol] === 'function';
const comparisonKey = (uri: URI): string =>
  JSON.stringify([uri.scheme, uri.authority, comparisonPath(uri), uri.query, uri.fragment]);
const fromUri = (uri: URI): HashableUri => {
  // Preserve segment casing for reads/display; only normalize the exposed drive letter.
  const normalized =
    uri.scheme === 'file' && /^\/[A-Z]:/.test(uri.path)
      ? uri.with({ path: uri.path.replace(/^\/[A-Z]:/, match => match.toLowerCase()) })
      : uri;
  const key = comparisonKey(normalized);
  return {
    uri: normalized,
    [Hash.symbol]: () => Hash.string(key),
    [Equal.symbol]: that => isHashableUri(that) && key === comparisonKey(that.uri)
  };
};
type UriChange = Parameters<URI['with']>[0];
const withUri: {
  (change: UriChange): (self: HashableUri) => HashableUri;
  (self: HashableUri, change: UriChange): HashableUri;
} = dual(2, (self: HashableUri, change: UriChange): HashableUri => fromUri(self.uri.with(change)));

export const HashableUri = { fromUri, with: withUri };
