/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Equal from 'effect/Equal';
import { dual } from 'effect/Function';
import * as Hash from 'effect/Hash';
import { isRecord, isString } from 'effect/Predicate';
import { URI } from 'vscode-uri';

/**
 * Wraps a `vscode-uri` `URI` with Effect's `Hash`/`Equal` interfaces so values can be
 * deduped in `HashMap`/`HashSet`. Uses a structural Equal so cross-bundle comparisons
 * work (each extension bundles its own `vscode-uri`, so subclass `instanceof` checks fail).
 *
 * Access the underlying URI via `.uri`. Use `HashableUri.fromUri` to construct.
 */
export type HashableUri = {
  readonly uri: URI;
  readonly [Hash.symbol]: () => number;
  readonly [Equal.symbol]: (that: unknown) => boolean;
};

type UriChange = Parameters<URI['with']>[0];

const hasObjectProp = <K extends string>(u: unknown, key: K): u is Record<K, object> =>
  isRecord(u) && key in u && isRecord(Object(u)[key]);

/**
 * Structural cross-bundle check: any value with a `uri` field that looks like a URI AND carries
 * Effect's `Equal.symbol` method. Requiring `Equal.symbol` keeps the Equal contract symmetric:
 * a plain `{uri}` literal would not satisfy `Hash.hash` requirements, so we must reject it here.
 */
const isHashableUriShape = (u: unknown): u is HashableUri =>
  hasObjectProp(u, 'uri') && isString(Object(u.uri).scheme) && typeof Object(u)[Equal.symbol] === 'function';

const comparisonKey = (uri: URI): string => {
  const path = uri.scheme === 'file' && /^\/[a-z]:/i.test(uri.path) ? uri.path.toLowerCase() : uri.path;
  // Use URI fields instead of toString(): VS Code and vscode-uri objects can
  // serialize the same URI differently across extension bundle boundaries.
  return JSON.stringify([uri.scheme, uri.authority, path, uri.query, uri.fragment]);
};

const fromUri = (uri: URI): HashableUri => {
  // Preserve path-segment casing for reads and display, but normalize the drive
  // letter exposed through .uri for compatibility with existing callers.
  const normalized =
    uri.scheme === 'file' && /^\/[A-Z]:/.test(uri.path)
      ? uri.with({ path: uri.path.replace(/^\/[A-Z]:/, match => match.toLowerCase()) })
      : uri;
  // Windows file paths are case-insensitive. VS Code and filesystem-backed
  // services can report different casing for any path segment, so use a
  // case-insensitive key without changing the URI consumers operate on.
  const key = comparisonKey(normalized);
  const self: HashableUri = {
    uri: normalized,
    [Hash.symbol]: () => Hash.string(key),
    [Equal.symbol]: (that: unknown) => isHashableUriShape(that) && key === comparisonKey(that.uri)
  };
  return self;
};

const withFn: {
  (change: UriChange): (self: HashableUri) => HashableUri;
  (self: HashableUri, change: UriChange): HashableUri;
} = dual(2, (self: HashableUri, change: UriChange): HashableUri => fromUri(self.uri.with(change)));

export const HashableUri = {
  fromUri,
  with: withFn
};
