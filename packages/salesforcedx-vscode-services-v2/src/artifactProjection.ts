/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';
import { ArtifactIdentitySchema, NonEmptyTrimmedString, SObjectArtifactIdentitySchema } from './artifactIdentity.js';
import { DocumentUriSchema } from './uriSchema.js';

export const ArtifactPresenceSchema = Schema.Literals(['workspace', 'org', 'both']);
export type ArtifactPresence = typeof ArtifactPresenceSchema.Type;
export const ArtifactProviderKindSchema = Schema.Literals(['workspace', 'metadata-api', 'rest-api', 'tooling-api']);
export type ArtifactProviderKind = typeof ArtifactProviderKindSchema.Type;
export const CatalogEntryDescriptorSchema = Schema.Struct({
  kind: Schema.Literal('catalog-entry'),
  identity: ArtifactIdentitySchema,
  presence: ArtifactPresenceSchema,
  providers: Schema.Array(ArtifactProviderKindSchema),
  workspaceUri: Schema.optional(DocumentUriSchema),
  orgUri: Schema.optional(DocumentUriSchema)
});
export type CatalogEntryDescriptor = typeof CatalogEntryDescriptorSchema.Type;
/** Actual source only; semantic projections cannot satisfy the source-document contract. */
export const SourceDocumentSchema = Schema.Struct({
  kind: Schema.Literal('source-document'),
  identity: ArtifactIdentitySchema,
  fidelity: Schema.Literal('actual-source'),
  uri: DocumentUriSchema,
  languageId: Schema.optional(NonEmptyTrimmedString)
});
export type SourceDocument = typeof SourceDocumentSchema.Type;
export const SObjectPicklistValueSchema = Schema.Struct({
  value: Schema.String,
  label: Schema.optional(Schema.String),
  active: Schema.optional(Schema.Boolean)
});
export type SObjectPicklistValue = typeof SObjectPicklistValueSchema.Type;
/** Unknown runtime capabilities stay absent, never fabricated as false. */
export const SObjectFieldRuntimeCapabilitiesSchema = Schema.Struct({
  aggregatable: Schema.Boolean,
  filterable: Schema.Boolean,
  groupable: Schema.Boolean,
  nillable: Schema.Boolean,
  sortable: Schema.Boolean
});
export type SObjectFieldRuntimeCapabilities = typeof SObjectFieldRuntimeCapabilitiesSchema.Type;
export const SObjectSemanticFieldSchema = Schema.Struct({
  name: NonEmptyTrimmedString,
  label: Schema.optional(Schema.String),
  type: Schema.optional(NonEmptyTrimmedString),
  custom: Schema.optional(Schema.Boolean),
  defaultValue: Schema.optional(Schema.Unknown),
  inlineHelpText: Schema.optional(Schema.String),
  length: Schema.optional(Schema.Number),
  precision: Schema.optional(Schema.Number),
  scale: Schema.optional(Schema.Number),
  referenceTo: NonEmptyTrimmedString.pipe(Schema.Array, Schema.optional),
  relationshipName: Schema.optional(Schema.String),
  picklistValues: SObjectPicklistValueSchema.pipe(Schema.Array, Schema.optional),
  runtimeCapabilities: Schema.optional(SObjectFieldRuntimeCapabilitiesSchema),
  definitionUri: Schema.optional(DocumentUriSchema)
});
export type SObjectSemanticField = typeof SObjectSemanticFieldSchema.Type;
export const SObjectChildRelationshipSchema = Schema.Struct({
  childSObject: NonEmptyTrimmedString,
  field: NonEmptyTrimmedString,
  relationshipName: Schema.optional(Schema.String)
});
export type SObjectChildRelationship = typeof SObjectChildRelationshipSchema.Type;
/** Canonical facts may be incomplete for workspace declarations and later enriched with REST facts. */
export const SObjectSemanticValueSchema = Schema.Struct({
  identity: SObjectArtifactIdentitySchema,
  label: Schema.optional(Schema.String),
  pluralLabel: Schema.optional(Schema.String),
  custom: Schema.optional(Schema.Boolean),
  queryable: Schema.optional(Schema.Boolean),
  fields: Schema.Array(SObjectSemanticFieldSchema),
  childRelationships: SObjectChildRelationshipSchema.pipe(Schema.Array, Schema.optional),
  definitionUri: Schema.optional(DocumentUriSchema)
});
export type SObjectSemanticValue = typeof SObjectSemanticValueSchema.Type;
export const SObjectSemanticModelSchema = Schema.Struct({
  kind: Schema.Literal('sobject'),
  value: SObjectSemanticValueSchema
});
export type SObjectSemanticModel = typeof SObjectSemanticModelSchema.Type;
export const CanonicalSemanticModelSchema = SObjectSemanticModelSchema;
export type CanonicalSemanticModel = typeof CanonicalSemanticModelSchema.Type;
export const CatalogEntryProjectionSchema = Schema.Struct({ kind: Schema.Literal('catalog-entry') });
export type CatalogEntryProjection = typeof CatalogEntryProjectionSchema.Type;
export const SourceDocumentProjectionSchema = Schema.Struct({ kind: Schema.Literal('source-document') });
export type SourceDocumentProjection = typeof SourceDocumentProjectionSchema.Type;
export const SObjectSemanticProjectionSchema = Schema.Struct({
  kind: Schema.Literal('semantic-model'),
  model: Schema.Literal('sobject')
});
export type SObjectSemanticProjection = typeof SObjectSemanticProjectionSchema.Type;
export const ArtifactProjectionSchema = Schema.Union([
  CatalogEntryProjectionSchema,
  SourceDocumentProjectionSchema,
  SObjectSemanticProjectionSchema
]);
export type ArtifactProjection = typeof ArtifactProjectionSchema.Type;
export const ProjectionUnavailableReasonSchema = Schema.Literal('protected-source');
export type ProjectionUnavailableReason = typeof ProjectionUnavailableReasonSchema.Type;
export const ProjectionUnavailableSchema = Schema.Struct({
  kind: Schema.Literal('projection-unavailable'),
  reason: ProjectionUnavailableReasonSchema,
  availableProjections: Schema.Array(ArtifactProjectionSchema)
});
export type ProjectionUnavailable = typeof ProjectionUnavailableSchema.Type;
export const ArtifactProjectionSchemas = {
  DocumentUri: DocumentUriSchema,
  CatalogEntryDescriptor: CatalogEntryDescriptorSchema,
  SourceDocument: SourceDocumentSchema,
  SObjectSemanticModel: SObjectSemanticModelSchema,
  CanonicalSemanticModel: CanonicalSemanticModelSchema,
  ArtifactProjection: ArtifactProjectionSchema,
  ProjectionUnavailable: ProjectionUnavailableSchema
} as const;
