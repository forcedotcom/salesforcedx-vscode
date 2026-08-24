/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { URI } from 'vscode-uri';
import {
  ApexTypeArtifactIdentitySchema,
  ArtifactIdentitySchema,
  ArtifactNamespaceSchema,
  SObjectArtifactIdentitySchema,
  type ArtifactNamespace
} from './artifactIdentity';

const UriTypeSchema = Schema.declare((value): value is URI => value instanceof URI, {
  identifier: 'URI',
  description: 'vscode-uri URI'
});

/** JSON-safe URI schema whose decoded TypeScript value is a vscode-uri URI. */
export const DocumentUriSchema = Schema.transform(Schema.String, UriTypeSchema, {
  strict: true,
  decode: value => URI.parse(value),
  encode: (_encoded, uri) => uri.toString()
});
export type DocumentUri = typeof DocumentUriSchema.Type;

export const ArtifactPresenceSchema = Schema.Literal('workspace', 'org', 'both');
export type ArtifactPresence = typeof ArtifactPresenceSchema.Type;

export const ArtifactProviderKindSchema = Schema.Literal(
  'workspace',
  'metadata-api',
  'rest-api',
  'tooling-api',
  'symbol-table'
);
export type ArtifactProviderKind = typeof ArtifactProviderKindSchema.Type;

/** Provider-neutral catalog information returned alongside any materialized projection. */
export const CatalogEntryDescriptorSchema = Schema.Struct({
  kind: Schema.Literal('catalog-entry'),
  identity: ArtifactIdentitySchema,
  presence: ArtifactPresenceSchema,
  providers: Schema.Array(ArtifactProviderKindSchema),
  workspaceUri: Schema.optional(DocumentUriSchema),
  orgUri: Schema.optional(DocumentUriSchema)
});
export type CatalogEntryDescriptor = typeof CatalogEntryDescriptorSchema.Type;

/** A URI that resolves to actual source. Symbol stubs cannot satisfy this contract. */
export const SourceDocumentSchema = Schema.Struct({
  kind: Schema.Literal('source-document'),
  identity: ArtifactIdentitySchema,
  fidelity: Schema.Literal('actual-source'),
  uri: DocumentUriSchema,
  languageId: Schema.optional(Schema.NonEmptyTrimmedString)
});
export type SourceDocument = typeof SourceDocumentSchema.Type;

export const SObjectPicklistValueSchema = Schema.Struct({
  value: Schema.String,
  label: Schema.optional(Schema.String),
  active: Schema.optional(Schema.Boolean)
});
export type SObjectPicklistValue = typeof SObjectPicklistValueSchema.Type;

/** Runtime capabilities are absent when a provider cannot know them, rather than being invented as false. */
export const SObjectFieldRuntimeCapabilitiesSchema = Schema.Struct({
  aggregatable: Schema.Boolean,
  filterable: Schema.Boolean,
  groupable: Schema.Boolean,
  nillable: Schema.Boolean,
  sortable: Schema.Boolean
});
export type SObjectFieldRuntimeCapabilities = typeof SObjectFieldRuntimeCapabilitiesSchema.Type;

export const SObjectSemanticFieldSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  label: Schema.optional(Schema.String),
  type: Schema.optional(Schema.NonEmptyTrimmedString),
  custom: Schema.optional(Schema.Boolean),
  defaultValue: Schema.optional(Schema.Unknown),
  inlineHelpText: Schema.optional(Schema.String),
  length: Schema.optional(Schema.Number),
  precision: Schema.optional(Schema.Number),
  scale: Schema.optional(Schema.Number),
  referenceTo: Schema.NonEmptyTrimmedString.pipe(Schema.Array, Schema.optional),
  relationshipName: Schema.optional(Schema.String),
  picklistValues: SObjectPicklistValueSchema.pipe(Schema.Array, Schema.optional),
  runtimeCapabilities: Schema.optional(SObjectFieldRuntimeCapabilitiesSchema),
  definitionUri: Schema.optional(DocumentUriSchema)
});
export type SObjectSemanticField = typeof SObjectSemanticFieldSchema.Type;

export const SObjectChildRelationshipSchema = Schema.Struct({
  childSObject: Schema.NonEmptyTrimmedString,
  field: Schema.NonEmptyTrimmedString,
  relationshipName: Schema.optional(Schema.String)
});
export type SObjectChildRelationship = typeof SObjectChildRelationshipSchema.Type;

/**
 * Canonical SObject facts shared by workspace metadata and org providers. Provider-specific facts are optional so
 * an incomplete workspace declaration remains truthful and can later be enriched by REST or Symbol Table data.
 */
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

type ApexTypeReferenceValue = {
  readonly namespacePrefix: ArtifactNamespace;
  readonly name: string;
  readonly typeParameters: readonly ApexTypeReferenceValue[] | null;
};

/** Canonical recursive Apex type reference: nullable provider fields are explicit rather than omitted. */
export const ApexTypeReferenceSchema: Schema.Schema<ApexTypeReferenceValue> = Schema.Struct({
  namespacePrefix: ArtifactNamespaceSchema,
  name: Schema.NonEmptyTrimmedString,
  typeParameters: Schema.suspend(() => ApexTypeReferenceSchema).pipe(Schema.Array, Schema.NullOr)
});
export type ApexTypeReference = typeof ApexTypeReferenceSchema.Type;

const NullableDocumentationSchema = Schema.NullOr(Schema.String);

export const ApexAnnotationParameterStubSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  type: ApexTypeReferenceSchema,
  value: Schema.String
});
export type ApexAnnotationParameterStub = typeof ApexAnnotationParameterStubSchema.Type;

export const ApexAnnotationStubSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  parameters: Schema.Array(ApexAnnotationParameterStubSchema),
  documentation: NullableDocumentationSchema
});
export type ApexAnnotationStub = typeof ApexAnnotationStubSchema.Type;

export const ApexAccessorStubSchema = Schema.Struct({
  modifiers: Schema.Array(Schema.String),
  documentation: NullableDocumentationSchema
});
export type ApexAccessorStub = typeof ApexAccessorStubSchema.Type;

export const ApexParameterStubSchema = Schema.Struct({
  name: Schema.NullOr(Schema.String),
  type: Schema.NullOr(ApexTypeReferenceSchema),
  annotations: Schema.Array(ApexAnnotationStubSchema),
  documentation: NullableDocumentationSchema
});
export type ApexParameterStub = typeof ApexParameterStubSchema.Type;

export const ApexMethodStubSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  isConstructor: Schema.NullOr(Schema.Boolean),
  returnType: Schema.NullOr(ApexTypeReferenceSchema),
  modifiers: Schema.Array(Schema.String),
  annotations: Schema.Array(ApexAnnotationStubSchema),
  parameters: Schema.Array(ApexParameterStubSchema),
  documentation: NullableDocumentationSchema,
  definingType: Schema.NullOr(ApexTypeReferenceSchema)
});
export type ApexMethodStub = typeof ApexMethodStubSchema.Type;

export const ApexFieldStubSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  type: Schema.NullOr(ApexTypeReferenceSchema),
  modifiers: Schema.Array(Schema.String),
  annotations: Schema.Array(ApexAnnotationStubSchema),
  documentation: NullableDocumentationSchema,
  definingType: Schema.NullOr(ApexTypeReferenceSchema)
});
export type ApexFieldStub = typeof ApexFieldStubSchema.Type;

export const ApexPropertyStubSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  type: Schema.NullOr(ApexTypeReferenceSchema),
  modifiers: Schema.Array(Schema.String),
  annotations: Schema.Array(ApexAnnotationStubSchema),
  getter: Schema.NullOr(ApexAccessorStubSchema),
  setter: Schema.NullOr(ApexAccessorStubSchema),
  documentation: NullableDocumentationSchema,
  definingType: Schema.NullOr(ApexTypeReferenceSchema)
});
export type ApexPropertyStub = typeof ApexPropertyStubSchema.Type;

export const ApexTypeKindSchema = Schema.Literal('CLASS', 'INTERFACE', 'ENUM', 'TRIGGER');
export type ApexTypeKind = typeof ApexTypeKindSchema.Type;

type ApexTypeStubValue = {
  readonly name: string;
  readonly namespacePrefix: ArtifactNamespace;
  readonly kind: ApexTypeKind;
  readonly modifiers: readonly string[];
  readonly annotations: readonly ApexAnnotationStub[];
  readonly superClass: ApexTypeReference | null;
  readonly interfaces: readonly ApexTypeReference[];
  readonly fields: readonly ApexFieldStub[];
  readonly properties: readonly ApexPropertyStub[];
  readonly methods: readonly ApexMethodStub[];
  readonly innerTypes: readonly ApexTypeStubValue[];
  readonly triggerOperations: readonly string[] | null;
  readonly triggerObjectType: ApexTypeReference | null;
  readonly documentation: string | null;
  readonly compileError: string | null;
};

export const ApexTypeStubSchema: Schema.Schema<ApexTypeStubValue> = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  namespacePrefix: ArtifactNamespaceSchema,
  kind: ApexTypeKindSchema,
  modifiers: Schema.Array(Schema.String),
  annotations: Schema.Array(ApexAnnotationStubSchema),
  superClass: Schema.NullOr(ApexTypeReferenceSchema),
  interfaces: Schema.Array(ApexTypeReferenceSchema),
  fields: Schema.Array(ApexFieldStubSchema),
  properties: Schema.Array(ApexPropertyStubSchema),
  methods: Schema.Array(ApexMethodStubSchema),
  innerTypes: Schema.Array(Schema.suspend(() => ApexTypeStubSchema)),
  triggerOperations: Schema.String.pipe(Schema.Array, Schema.NullOr),
  triggerObjectType: Schema.NullOr(ApexTypeReferenceSchema),
  documentation: NullableDocumentationSchema,
  compileError: Schema.NullOr(Schema.String)
});
export type ApexTypeStub = typeof ApexTypeStubSchema.Type;

export const ApexTypeStubSemanticModelSchema = Schema.Struct({
  kind: Schema.Literal('apex-type-stub'),
  identity: ApexTypeArtifactIdentitySchema,
  value: ApexTypeStubSchema
});
export type ApexTypeStubSemanticModel = typeof ApexTypeStubSemanticModelSchema.Type;

export const CanonicalSemanticModelSchema = Schema.Union(SObjectSemanticModelSchema, ApexTypeStubSemanticModelSchema);
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

export const ApexTypeStubSemanticProjectionSchema = Schema.Struct({
  kind: Schema.Literal('semantic-model'),
  model: Schema.Literal('apex-type-stub')
});
export type ApexTypeStubSemanticProjection = typeof ApexTypeStubSemanticProjectionSchema.Type;

export const ArtifactProjectionSchema = Schema.Union(
  CatalogEntryProjectionSchema,
  SourceDocumentProjectionSchema,
  SObjectSemanticProjectionSchema,
  ApexTypeStubSemanticProjectionSchema
);
export type ArtifactProjection = typeof ArtifactProjectionSchema.Type;

export const ProjectionUnavailableReasonSchema = Schema.Literal(
  'projection-unavailable',
  'protected-source',
  'compile-error',
  'unsupported-org-capability'
);
export type ProjectionUnavailableReason = typeof ProjectionUnavailableReasonSchema.Type;

export const ProjectionUnavailableSchema = Schema.Struct({
  kind: Schema.Literal('projection-unavailable'),
  reason: ProjectionUnavailableReasonSchema,
  availableProjections: Schema.Array(ArtifactProjectionSchema)
});
export type ProjectionUnavailable = typeof ProjectionUnavailableSchema.Type;

/** Runtime schemas exposed through the VS Code Services extension API. */
export const ArtifactProjectionSchemas = {
  DocumentUri: DocumentUriSchema,
  CatalogEntryDescriptor: CatalogEntryDescriptorSchema,
  SourceDocument: SourceDocumentSchema,
  SObjectSemanticModel: SObjectSemanticModelSchema,
  ApexTypeReference: ApexTypeReferenceSchema,
  ApexTypeStub: ApexTypeStubSchema,
  ApexTypeStubSemanticModel: ApexTypeStubSemanticModelSchema,
  CanonicalSemanticModel: CanonicalSemanticModelSchema,
  ArtifactProjection: ArtifactProjectionSchema,
  ProjectionUnavailable: ProjectionUnavailableSchema
} as const;
