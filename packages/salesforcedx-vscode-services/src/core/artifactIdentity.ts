/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export const ArtifactTargetKindSchema = Schema.Literal('metadata-component', 'sobject');
export type ArtifactTargetKind = typeof ArtifactTargetKindSchema.Type;

export const ArtifactNamespaceSchema = Schema.NullOr(Schema.NonEmptyTrimmedString);
export type ArtifactNamespace = typeof ArtifactNamespaceSchema.Type;

const ArtifactIdentityFields = {
  namespace: ArtifactNamespaceSchema,
  name: Schema.NonEmptyTrimmedString
} as const;

export const MetadataComponentArtifactIdentitySchema = Schema.Struct({
  kind: Schema.Literal('metadata-component'),
  metadataType: Schema.NonEmptyTrimmedString,
  ...ArtifactIdentityFields
});
export type MetadataComponentArtifactIdentity = typeof MetadataComponentArtifactIdentitySchema.Type;

export const SObjectArtifactIdentitySchema = Schema.Struct({
  kind: Schema.Literal('sobject'),
  ...ArtifactIdentityFields
});
export type SObjectArtifactIdentity = typeof SObjectArtifactIdentitySchema.Type;

/** Provider-neutral identity shared by workspace, org, cache, and persistence providers. */
export const ArtifactIdentitySchema = Schema.Union(
  MetadataComponentArtifactIdentitySchema,
  SObjectArtifactIdentitySchema
);
export type ArtifactIdentity = typeof ArtifactIdentitySchema.Type;

/** Locale-independent comparison normalization. Canonical provider casing remains on the identity itself. */
export const normalizeArtifactIdentityPart = (value: string): string => value.toLowerCase();

export const normalizeArtifactNamespace = (namespace: ArtifactNamespace): ArtifactNamespace =>
  namespace === null ? null : normalizeArtifactIdentityPart(namespace);

export const normalizeArtifactIdentity = (identity: ArtifactIdentity): ArtifactIdentity => ({
  ...identity,
  ...(identity.kind === 'metadata-component'
    ? { metadataType: normalizeArtifactIdentityPart(identity.metadataType) }
    : {}),
  namespace: normalizeArtifactNamespace(identity.namespace),
  name: normalizeArtifactIdentityPart(identity.name)
});

/** Stable comparison/cache key. Namespace remains a distinct tuple member rather than being added to the name. */
export const artifactIdentityKey = (identity: ArtifactIdentity): string => {
  const normalized = normalizeArtifactIdentity(identity);
  return JSON.stringify([
    normalized.kind,
    normalized.kind === 'metadata-component' ? normalized.metadataType : null,
    normalized.namespace,
    normalized.name
  ]);
};

export const artifactIdentitiesEqual = (left: ArtifactIdentity, right: ArtifactIdentity): boolean =>
  artifactIdentityKey(left) === artifactIdentityKey(right);

export const artifactNamespacesEqual = (left: ArtifactNamespace, right: ArtifactNamespace): boolean =>
  normalizeArtifactNamespace(left) === normalizeArtifactNamespace(right);
