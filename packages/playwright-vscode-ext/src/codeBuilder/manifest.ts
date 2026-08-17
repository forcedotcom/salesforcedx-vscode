/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * The Manifest is the contract object linking swap → verify, and doubles as the persisted provenance
 * record (what bytes were installed, by version+digest). Swap emits it; verify consumes it as the
 * "expected" side and holds no state of its own.
 *
 * It is an Effect Schema so it is validated at every boundary — read back from disk in a later CI
 * step, handed to verify — rather than trusted as an untyped blob. Persisted to a manifest.json a
 * human can diff to see exactly what was under test.
 */

import type { ExtensionDigest } from './digest';
import * as Either from 'effect/Either';
import * as Schema from 'effect/Schema';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/** One manifest entry: the extension id, its version, and its composite content digest. */
export const ManifestEntrySchema = Schema.Struct({
  /** Full publisher-qualified id, e.g. "salesforce.salesforcedx-vscode-core". */
  id: Schema.String,
  /** The version under test, e.g. "67.4.0". */
  version: Schema.String,
  /** sha256 of package.json bytes. */
  pkgJsonDigest: Schema.String,
  /** sha256 of the `main` bundle bytes, or null for a declarative extension (no `main`). */
  bundleDigest: Schema.NullOr(Schema.String)
});

export type ManifestEntry = Schema.Schema.Type<typeof ManifestEntrySchema>;

/** The full manifest: every extension swapped in, keyed for lookup by verify. */
export const ManifestSchema = Schema.Struct({
  /** Schema version of the manifest file itself, so a reader can detect format drift. */
  schemaVersion: Schema.Literal(1),
  entries: Schema.Array(ManifestEntrySchema)
});

export type Manifest = Schema.Schema.Type<typeof ManifestSchema>;

/** Build a Manifest from swap results: id → version + the digest computed at install time. */
export const makeManifest = (entries: readonly ({ id: string; version: string } & ExtensionDigest)[]): Manifest => ({
  schemaVersion: 1,
  entries: entries.map(e => ({
    id: e.id,
    version: e.version,
    pkgJsonDigest: e.pkgJsonDigest,
    bundleDigest: e.bundleDigest
  }))
});

const encode = Schema.encodeSync(ManifestSchema);
const decodeEither = Schema.decodeUnknownEither(ManifestSchema);

/** Serialize + write the manifest to disk (the provenance artifact CI uploads). */
export const writeManifest = (path: string, manifest: Manifest): void => {
  writeFileSync(path, `${JSON.stringify(encode(manifest), null, 2)}\n`, 'utf-8');
};

/** Read + validate a manifest from disk. Throws with the schema error if the file is malformed. */
export const readManifest = (path: string): Manifest => {
  if (!existsSync(path)) {
    throw new Error(`manifest not found: ${path}`);
  }
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'));
  const result = decodeEither(parsed);
  if (Either.isLeft(result)) {
    throw new Error(`invalid manifest at ${path}: ${String(result.left)}`);
  }
  return result.right;
};
