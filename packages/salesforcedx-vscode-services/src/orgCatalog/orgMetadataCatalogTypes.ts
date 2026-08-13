/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgMetadataReference } from './orgMetadataReference';
import * as Schema from 'effect/Schema';
import { URI } from 'vscode-uri';
import { SObjectSchema } from '../core/transmogrifierService';

export type OrgMetadataPresence = {
  readonly inOrg: boolean;
  readonly inWorkspace: boolean;
  readonly workspaceUri?: URI;
};

export type OrgMetadataConsistency = 'cache-first' | 'refresh';

export type OrgMetadataHierarchyConsistency = OrgMetadataConsistency | 'cache-only';

/** Public catalog hierarchy reference. Metadata API `xmlName` is exposed as the conventional `type`. */
export type OrgMetadataCatalogReference = {
  readonly type?: string;
  readonly fullName?: string;
};

export type OrgMetadataCatalogComponentReference = {
  readonly type: string;
  readonly fullName: string;
};

/** Document resolution for a consumer-discovered org component. */
export type OrgMetadataComponentResolution = {
  readonly reference: OrgMetadataCatalogComponentReference;
  readonly presence: 'org' | 'both';
  readonly preferredUri: URI;
  readonly orgUri: URI;
  readonly workspaceUri?: URI;
};

export const OrgCatalogObservationSchema = Schema.Struct({
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
export type OrgCatalogObservation = typeof OrgCatalogObservationSchema.Type;

export const OrgSObjectSummarySchema = Schema.Struct({
  ...OrgCatalogObservationSchema.fields,
  name: Schema.String,
  custom: Schema.Boolean,
  queryable: Schema.Boolean
});
export type OrgSObjectSummary = typeof OrgSObjectSummarySchema.Type;

export const OrgSObjectDescriptionSchema = Schema.Struct({
  ...SObjectSchema.fields,
  ...OrgCatalogObservationSchema.fields
});
export type OrgSObjectDescription = typeof OrgSObjectDescriptionSchema.Type;

export type OrgMetadataEntryKind = 'type' | 'folder' | 'component';

export type OrgMetadataFieldDetails = {
  readonly name: string;
  readonly type: string;
  readonly length?: number;
  readonly relationshipName?: string | null;
  readonly scale?: number;
  readonly precision?: number;
};

type OrgMetadataCatalogEntryBase = OrgMetadataPresence & {
  readonly orgId: string;
  readonly observedAt: string;
  readonly provenance: OrgCatalogObservation['provenance'];
  readonly name: string;
  readonly kind: OrgMetadataEntryKind;
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
export type OrgMetadataCatalogInternalEntry = OrgMetadataCatalogEntryBase & {
  readonly reference: OrgMetadataReference;
};

/** Consumer-facing entry shape. */
export type OrgMetadataCatalogEntry = OrgMetadataCatalogEntryBase & {
  readonly reference: OrgMetadataCatalogReference;
};
