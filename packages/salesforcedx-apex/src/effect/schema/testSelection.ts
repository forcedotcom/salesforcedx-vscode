/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexClassId } from '../../schemas/salesforceId';

export const UnqualifiedNameSchema = Schema.TaggedStruct('UnqualifiedName', { name: Schema.String });
export const QualifiedNameSchema = Schema.TaggedStruct('QualifiedName', {
  namespace: Schema.String,
  name: Schema.String,
  suffix: Schema.Array(Schema.String)
});
export type DottedName = typeof UnqualifiedNameSchema.Type | typeof QualifiedNameSchema.Type;

export const ApexClassIdSelectionSchema = Schema.TaggedStruct('ApexClassId', { classId: ApexClassId });
export const ApexClassSelectionSchema = Schema.TaggedStruct('ApexClass', {
  className: Schema.String,
  namespace: Schema.optional(Schema.String)
});
export const ApexMethodSelectionSchema = Schema.TaggedStruct('ApexMethod', {
  className: Schema.String,
  method: Schema.String,
  namespace: Schema.optional(Schema.String)
});
export const FlowClassSelectionSchema = Schema.TaggedStruct('FlowClass', {
  className: Schema.String,
  namespace: Schema.optional(Schema.String)
});
export const FlowMethodSelectionSchema = Schema.TaggedStruct('FlowMethod', {
  className: Schema.String,
  method: Schema.String,
  namespace: Schema.optional(Schema.String)
});

export const AmbiguousApexSelectionSchema = Schema.TaggedStruct('AmbiguousApex', {
  namespace: Schema.String,
  classCandidate: ApexClassSelectionSchema,
  methodCandidate: ApexMethodSelectionSchema
});
export const AmbiguousFlowSelectionSchema = Schema.TaggedStruct('AmbiguousFlow', {
  namespace: Schema.String,
  classCandidate: FlowClassSelectionSchema,
  methodCandidate: FlowMethodSelectionSchema
});

export type TestSelection =
  | typeof ApexClassIdSelectionSchema.Type
  | typeof ApexClassSelectionSchema.Type
  | typeof ApexMethodSelectionSchema.Type
  | typeof FlowClassSelectionSchema.Type
  | typeof FlowMethodSelectionSchema.Type
  | typeof AmbiguousApexSelectionSchema.Type
  | typeof AmbiguousFlowSelectionSchema.Type;

export type ResolvedTestSelection =
  | typeof ApexClassIdSelectionSchema.Type
  | typeof ApexClassSelectionSchema.Type
  | typeof ApexMethodSelectionSchema.Type
  | typeof FlowClassSelectionSchema.Type
  | typeof FlowMethodSelectionSchema.Type;
