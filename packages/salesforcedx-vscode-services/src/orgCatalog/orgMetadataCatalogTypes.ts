/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgMetadataReference } from './orgMetadataReference';
import type { SObject } from '../core/schemas/sObject';
import * as Schema from 'effect/Schema';
import { URI } from 'vscode-uri';

const UriSchema = Schema.declare((value): value is URI => value instanceof URI, {
  identifier: 'URI',
  description: 'vscode-uri URI'
});

const OrgMetadataPresenceSchema = Schema.Struct({
  inOrg: Schema.Boolean,
  inWorkspace: Schema.Boolean,
  workspaceUri: Schema.optional(UriSchema)
});
type OrgMetadataPresence = typeof OrgMetadataPresenceSchema.Type;

export type OrgMetadataConsistency = 'cache-first' | 'refresh';

export type OrgMetadataHierarchyConsistency = OrgMetadataConsistency | 'cache-only';

/** Catalog hierarchy reference. Metadata API `xmlName` is exposed as the conventional `type`. */
export type OrgMetadataCatalogReference = {
  readonly type?: string;
  readonly fullName?: string;
};

const OrgMetadataCatalogComponentReferenceSchema = Schema.Struct({
  type: Schema.String.pipe(Schema.minLength(1)),
  fullName: Schema.String.pipe(Schema.minLength(1))
});
export type OrgMetadataCatalogComponentReference = typeof OrgMetadataCatalogComponentReferenceSchema.Type;

const OrgCatalogObservationSchema = Schema.Struct({
  orgId: Schema.String,
  observedAt: Schema.String,
  provenance: Schema.Literal(
    'metadata-api',
    'rest-api',
    'tooling-api',
    'workspace',
    'metadata-api+workspace',
    'source-tracking'
  ),
  remoteLastModifiedDate: Schema.optional(Schema.String)
});
type OrgCatalogObservation = typeof OrgCatalogObservationSchema.Type;

export type OrgSObjectSummary = OrgCatalogObservation & Pick<SObject, 'name' | 'custom' | 'queryable'>;
export type OrgSObjectDescription = SObject & OrgCatalogObservation;

const OrgMetadataFieldDetailsSchema = Schema.Struct({
  name: Schema.String,
  type: Schema.String,
  length: Schema.optional(Schema.Number),
  relationshipName: Schema.String.pipe(Schema.NullOr, Schema.optional),
  scale: Schema.optional(Schema.Number),
  precision: Schema.optional(Schema.Number)
});
export type OrgMetadataFieldDetails = typeof OrgMetadataFieldDetailsSchema.Type;

type OrgMetadataCatalogEntryBase = OrgMetadataPresence & {
  readonly orgId: string;
  readonly observedAt: string;
  readonly provenance: OrgCatalogObservation['provenance'];
  readonly name: string;
  readonly documentUri: URI;
  readonly namespacePrefix?: string;
  readonly manageableState?: string;
  readonly fileName?: string;
  readonly lastModifiedByName?: string;
  readonly lastModifiedDate?: string;
  readonly remoteLastModifiedDate?: string;
  readonly field?: OrgMetadataFieldDetails;
};

/** Services-internal entry shape used by catalog storage and projections. */
export type OrgMetadataCatalogInternalEntry = OrgMetadataCatalogEntryBase &
  (
    | { readonly kind: 'type'; readonly reference: OrgMetadataReference & { readonly xmlName: string } }
    | {
        readonly kind: 'folder' | 'component';
        readonly reference: OrgMetadataReference & { readonly xmlName: string; readonly fullName: string };
      }
  );

const OrgMetadataCatalogEntryBaseSchema = Schema.Struct({
  ...OrgMetadataPresenceSchema.fields,
  orgId: Schema.String,
  observedAt: Schema.String,
  provenance: OrgCatalogObservationSchema.fields.provenance,
  name: Schema.String,
  documentUri: UriSchema,
  namespacePrefix: Schema.optional(Schema.String),
  manageableState: Schema.optional(Schema.String),
  fileName: Schema.optional(Schema.String),
  lastModifiedByName: Schema.optional(Schema.String),
  lastModifiedDate: Schema.optional(Schema.String),
  remoteLastModifiedDate: Schema.optional(Schema.String)
});

/** Runtime schemas for the catalog entry refinements consumed by Org Browser. */
const OrgMetadataCatalogFolderEntrySchema = Schema.Struct({
  ...OrgMetadataCatalogEntryBaseSchema.fields,
  kind: Schema.Literal('folder'),
  reference: OrgMetadataCatalogComponentReferenceSchema,
  field: Schema.optional(OrgMetadataFieldDetailsSchema)
});
export type OrgMetadataCatalogFolderEntry = typeof OrgMetadataCatalogFolderEntrySchema.Type;

const OrgMetadataCatalogTypeEntrySchema = Schema.Struct({
  ...OrgMetadataCatalogEntryBaseSchema.fields,
  kind: Schema.Literal('type'),
  reference: Schema.Struct({ type: Schema.String.pipe(Schema.minLength(1)) }),
  field: Schema.optional(OrgMetadataFieldDetailsSchema)
});

const OrgMetadataCatalogComponentEntrySchema = Schema.Struct({
  ...OrgMetadataCatalogEntryBaseSchema.fields,
  kind: Schema.Literal('component'),
  reference: OrgMetadataCatalogComponentReferenceSchema,
  field: Schema.optional(OrgMetadataFieldDetailsSchema)
});
export type OrgMetadataCatalogComponentEntry = typeof OrgMetadataCatalogComponentEntrySchema.Type;

export type OrgMetadataCatalogFieldEntry = Omit<OrgMetadataCatalogComponentEntry, 'field'> & {
  readonly field: OrgMetadataFieldDetails;
};

export const OrgMetadataCatalogEntrySchema = Schema.Union(
  OrgMetadataCatalogTypeEntrySchema,
  OrgMetadataCatalogFolderEntrySchema,
  OrgMetadataCatalogComponentEntrySchema
);
/** Consumer-facing catalog entry. */
export type OrgMetadataCatalogEntry = typeof OrgMetadataCatalogEntrySchema.Type;
