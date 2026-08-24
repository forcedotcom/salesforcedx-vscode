/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexTypeKindSchema, type ApexTypeKind } from './artifactProjection';

type RawApexTypeReferenceValue = {
  readonly namespacePrefix?: string | null;
  readonly name: string;
  readonly typeParameters?: readonly RawApexTypeReferenceValue[] | null;
};

/** Provider-native TypeReference. The service currently emits both omitted and explicit-null optional fields. */
export const RawApexTypeReferenceSchema: Schema.Schema<RawApexTypeReferenceValue> = Schema.Struct({
  namespacePrefix: Schema.String.pipe(Schema.NullOr, Schema.optional),
  name: Schema.NonEmptyTrimmedString,
  typeParameters: Schema.suspend(() => RawApexTypeReferenceSchema).pipe(Schema.Array, Schema.NullOr, Schema.optional)
});
export type RawApexTypeReference = typeof RawApexTypeReferenceSchema.Type;

export const RawApexAnnotationParameterStubSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  type: RawApexTypeReferenceSchema,
  value: Schema.String
});
export type RawApexAnnotationParameterStub = typeof RawApexAnnotationParameterStubSchema.Type;

export const RawApexAnnotationStubSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  parameters: RawApexAnnotationParameterStubSchema.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  documentation: Schema.String.pipe(Schema.NullOr, Schema.optional)
});
export type RawApexAnnotationStub = typeof RawApexAnnotationStubSchema.Type;

export const RawApexAccessorStubSchema = Schema.Struct({
  modifiers: Schema.String.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  documentation: Schema.String.pipe(Schema.NullOr, Schema.optional)
});
export type RawApexAccessorStub = typeof RawApexAccessorStubSchema.Type;

export const RawApexParameterStubSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.NullOr, Schema.optional),
  type: RawApexTypeReferenceSchema.pipe(Schema.NullOr, Schema.optional),
  annotations: RawApexAnnotationStubSchema.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  documentation: Schema.String.pipe(Schema.NullOr, Schema.optional)
});
export type RawApexParameterStub = typeof RawApexParameterStubSchema.Type;

export const RawApexMethodStubSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  isConstructor: Schema.Boolean.pipe(Schema.NullOr, Schema.optional),
  returnType: RawApexTypeReferenceSchema.pipe(Schema.NullOr, Schema.optional),
  modifiers: Schema.String.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  annotations: RawApexAnnotationStubSchema.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  parameters: RawApexParameterStubSchema.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  documentation: Schema.String.pipe(Schema.NullOr, Schema.optional),
  definingType: RawApexTypeReferenceSchema.pipe(Schema.NullOr, Schema.optional)
});
export type RawApexMethodStub = typeof RawApexMethodStubSchema.Type;

export const RawApexFieldStubSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  type: RawApexTypeReferenceSchema.pipe(Schema.NullOr, Schema.optional),
  modifiers: Schema.String.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  annotations: RawApexAnnotationStubSchema.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  documentation: Schema.String.pipe(Schema.NullOr, Schema.optional),
  definingType: RawApexTypeReferenceSchema.pipe(Schema.NullOr, Schema.optional)
});
export type RawApexFieldStub = typeof RawApexFieldStubSchema.Type;

export const RawApexPropertyStubSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  type: RawApexTypeReferenceSchema.pipe(Schema.NullOr, Schema.optional),
  modifiers: Schema.String.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  annotations: RawApexAnnotationStubSchema.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  getter: RawApexAccessorStubSchema.pipe(Schema.NullOr, Schema.optional),
  setter: RawApexAccessorStubSchema.pipe(Schema.NullOr, Schema.optional),
  documentation: Schema.String.pipe(Schema.NullOr, Schema.optional),
  definingType: RawApexTypeReferenceSchema.pipe(Schema.NullOr, Schema.optional)
});
export type RawApexPropertyStub = typeof RawApexPropertyStubSchema.Type;

type RawApexTypeStubValue = {
  readonly name: string;
  readonly namespacePrefix?: string | null;
  readonly kind: ApexTypeKind;
  readonly modifiers?: readonly string[] | null;
  readonly annotations?: readonly RawApexAnnotationStub[] | null;
  readonly superClass?: RawApexTypeReference | null;
  readonly interfaces?: readonly RawApexTypeReference[] | null;
  readonly fields?: readonly RawApexFieldStub[] | null;
  readonly properties?: readonly RawApexPropertyStub[] | null;
  readonly methods?: readonly RawApexMethodStub[] | null;
  readonly innerTypes?: readonly RawApexTypeStubValue[] | null;
  readonly triggerOperations?: readonly string[] | null;
  readonly triggerObjectType?: RawApexTypeReference | null;
  readonly documentation?: string | null;
  readonly compileError?: string | null;
};

/** Raw TYPE_STUB payload. Canonical completeness and ordering are enforced by TransmogrifierService. */
export const RawApexTypeStubSchema: Schema.Schema<RawApexTypeStubValue> = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  namespacePrefix: Schema.String.pipe(Schema.NullOr, Schema.optional),
  kind: ApexTypeKindSchema,
  modifiers: Schema.String.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  annotations: RawApexAnnotationStubSchema.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  superClass: RawApexTypeReferenceSchema.pipe(Schema.NullOr, Schema.optional),
  interfaces: RawApexTypeReferenceSchema.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  fields: RawApexFieldStubSchema.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  properties: RawApexPropertyStubSchema.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  methods: RawApexMethodStubSchema.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  innerTypes: Schema.suspend(() => RawApexTypeStubSchema).pipe(Schema.Array, Schema.NullOr, Schema.optional),
  triggerOperations: Schema.String.pipe(Schema.Array, Schema.NullOr, Schema.optional),
  triggerObjectType: RawApexTypeReferenceSchema.pipe(Schema.NullOr, Schema.optional),
  documentation: Schema.String.pipe(Schema.NullOr, Schema.optional),
  compileError: Schema.String.pipe(Schema.NullOr, Schema.optional)
});
export type RawApexTypeStub = typeof RawApexTypeStubSchema.Type;

export const RawApexTypeStubResponseSchema = Schema.Struct({
  typeStubs: Schema.Array(RawApexTypeStubSchema)
});
export type RawApexTypeStubResponse = typeof RawApexTypeStubResponseSchema.Type;

export const ApexSymbolTableSchemas = {
  TypeReference: RawApexTypeReferenceSchema,
  AnnotationParameterStub: RawApexAnnotationParameterStubSchema,
  AnnotationStub: RawApexAnnotationStubSchema,
  AccessorStub: RawApexAccessorStubSchema,
  ParameterStub: RawApexParameterStubSchema,
  MethodStub: RawApexMethodStubSchema,
  FieldStub: RawApexFieldStubSchema,
  PropertyStub: RawApexPropertyStubSchema,
  TypeStub: RawApexTypeStubSchema,
  TypeStubResponse: RawApexTypeStubResponseSchema
} as const;
