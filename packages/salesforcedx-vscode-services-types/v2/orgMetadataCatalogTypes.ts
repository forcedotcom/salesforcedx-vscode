/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OrgMetadataReference } from './orgMetadataReference.js';
import type { SObject } from './sObject.js';
import * as Schema from 'effect/Schema';
import { OrgId } from './defaultOrgInfo.js';
import { UriSchema } from './uriSchema.js';

const Presence = Schema.Struct({
  inOrg: Schema.Boolean,
  inWorkspace: Schema.Boolean,
  workspacePresenceAvailable: Schema.optional(Schema.Boolean),
  workspaceUri: Schema.optional(UriSchema)
});
export type OrgMetadataConsistency = 'cache-first' | 'refresh';
export type OrgMetadataHierarchyConsistency = OrgMetadataConsistency | 'cache-only';
/** Consumer-facing metadata hierarchy uses conventional `type`, not internal `xmlName`. */
export type OrgMetadataCatalogReference = { readonly type?: string; readonly fullName?: string };
const ComponentReference = Schema.Struct({ type: Schema.NonEmptyString, fullName: Schema.NonEmptyString });
export type OrgMetadataCatalogComponentReference = typeof ComponentReference.Type;
const Observation = Schema.Struct({
  orgId: OrgId,
  observedAt: Schema.String,
  provenance: Schema.Literals([
    'metadata-api',
    'rest-api',
    'tooling-api',
    'workspace',
    'metadata-api+workspace',
    'source-tracking'
  ]),
  remoteLastModifiedDate: Schema.optional(Schema.String)
});
export type OrgSObjectSummary = typeof Observation.Type & Pick<SObject, 'name' | 'custom' | 'queryable'>;
export type OrgSObjectDescription = SObject & typeof Observation.Type;
const FieldDetails = Schema.Struct({
  name: Schema.String,
  type: Schema.String,
  length: Schema.optional(Schema.Number),
  relationshipName: Schema.String.pipe(Schema.NullOr, Schema.optional),
  scale: Schema.optional(Schema.Number),
  precision: Schema.optional(Schema.Number)
});
export type OrgMetadataFieldDetails = typeof FieldDetails.Type;
const EntryBase = Schema.Struct({
  ...Presence.fields,
  ...Observation.fields,
  name: Schema.String,
  documentUri: UriSchema,
  namespacePrefix: Schema.optional(Schema.String),
  manageableState: Schema.optional(Schema.String),
  fileName: Schema.optional(Schema.String),
  lastModifiedByName: Schema.optional(Schema.String),
  lastModifiedDate: Schema.optional(Schema.String)
});
type InternalEntryBase = typeof EntryBase.Type & { readonly field?: OrgMetadataFieldDetails };
export type OrgMetadataCatalogInternalEntry = InternalEntryBase &
  (
    | { readonly kind: 'type'; readonly reference: OrgMetadataReference & { readonly xmlName: string } }
    | {
        readonly kind: 'folder' | 'component';
        readonly reference: OrgMetadataReference & { readonly xmlName: string; readonly fullName: string };
      }
  );
const FolderEntry = Schema.Struct({
  ...EntryBase.fields,
  kind: Schema.Literal('folder'),
  reference: ComponentReference,
  field: Schema.optional(FieldDetails)
});
export type OrgMetadataCatalogFolderEntry = typeof FolderEntry.Type;
const TypeEntry = Schema.Struct({
  ...EntryBase.fields,
  kind: Schema.Literal('type'),
  reference: Schema.Struct({ type: Schema.NonEmptyString }),
  field: Schema.optional(FieldDetails)
});
const ComponentEntry = Schema.Struct({
  ...EntryBase.fields,
  kind: Schema.Literal('component'),
  reference: ComponentReference,
  field: Schema.optional(FieldDetails)
});
export type OrgMetadataCatalogComponentEntry = typeof ComponentEntry.Type;
export type OrgMetadataCatalogFieldEntry = Omit<OrgMetadataCatalogComponentEntry, 'field'> & {
  readonly field: OrgMetadataFieldDetails;
};
export const OrgMetadataCatalogEntrySchema = Schema.Union([TypeEntry, FolderEntry, ComponentEntry]);
export type OrgMetadataCatalogEntry = typeof OrgMetadataCatalogEntrySchema.Type;
