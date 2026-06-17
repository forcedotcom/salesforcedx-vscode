/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Equal from 'effect/Equal';
import { dual } from 'effect/Function';
import * as Hash from 'effect/Hash';
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
  u !== null && typeof u === 'object' && key in u && typeof Object(u)[key] === 'object' && Object(u)[key] !== null;

/**
 * Structural cross-bundle check: any value with a `uri` field that looks like a URI AND carries
 * Effect's `Equal.symbol` method. Requiring `Equal.symbol` keeps the Equal contract symmetric:
 * a plain `{uri}` literal would not satisfy `Hash.hash` requirements, so we must reject it here.
 */
const isHashableUriShape = (u: unknown): u is HashableUri =>
  hasObjectProp(u, 'uri') && typeof Object(u.uri).scheme === 'string' && typeof Object(u)[Equal.symbol] === 'function';

const fromUri = (uri: URI): HashableUri => {
  // Normalize Windows drive letters to lowercase — VS Code URIs may have /C:/ or /c:/
  // depending on the source (context menu, readDirectory, workspace folder, etc.).
  // Consistent lowercase ensures HashSet comparisons work regardless of origin.
  // Gated on file scheme; non-file URIs do not use drive letters.
  const normalized =
    uri.scheme === 'file' && /^\/[A-Z]:/.test(uri.path)
      ? uri.with({ path: uri.path.replace(/^\/[A-Z]:/, m => m.toLowerCase()) })
      : uri;
  const self: HashableUri = {
    uri: normalized,
    [Hash.symbol]: () => Hash.string(normalized.toString()),
    [Equal.symbol]: (that: unknown) => isHashableUriShape(that) && normalized.toString() === that.uri.toString()
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
