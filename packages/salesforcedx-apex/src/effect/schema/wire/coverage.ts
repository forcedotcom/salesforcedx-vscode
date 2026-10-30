/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexClassIdString } from '../../../schemas/salesforceId.js';
import {
  ApexClassOrTriggerIdSchema,
  CoverageLineCountSchema,
  CoverageLinesSchema,
  CoveragePercentSchema
} from '../coverage.js';

const ApexClassOrTriggerSchema = Schema.Struct({ Id: ApexClassOrTriggerIdSchema, Name: Schema.String });

export const ApexCodeCoverageRecordSchema = Schema.Struct({
  ApexClassOrTrigger: ApexClassOrTriggerSchema,
  ApexTestClassId: ApexClassIdString,
  TestMethodName: Schema.String,
  NumLinesCovered: CoverageLineCountSchema,
  NumLinesUncovered: CoverageLineCountSchema,
  Coverage: Schema.optional(CoverageLinesSchema)
}).annotate({ identifier: 'ApexCodeCoverageRecord' });
export type ApexCodeCoverageRecord = typeof ApexCodeCoverageRecordSchema.Type;

export const ApexCodeCoverageSchema = Schema.Struct({
  done: Schema.Boolean,
  totalSize: Schema.Number,
  records: Schema.mutable(Schema.Array(ApexCodeCoverageRecordSchema))
}).annotate({ identifier: 'ApexCodeCoverage' });
export type ApexCodeCoverage = typeof ApexCodeCoverageSchema.Type;

export const ApexCodeCoverageAggregateRecordSchema = Schema.Struct({
  ApexClassOrTrigger: ApexClassOrTriggerSchema,
  NumLinesCovered: CoverageLineCountSchema,
  NumLinesUncovered: CoverageLineCountSchema,
  Coverage: CoverageLinesSchema
}).annotate({ identifier: 'ApexCodeCoverageAggregateRecord' });
export type ApexCodeCoverageAggregateRecord = typeof ApexCodeCoverageAggregateRecordSchema.Type;

export const ApexCodeCoverageAggregateSchema = Schema.Struct({
  done: Schema.Boolean,
  totalSize: Schema.Number,
  records: Schema.mutable(Schema.Array(ApexCodeCoverageAggregateRecordSchema))
}).annotate({ identifier: 'ApexCodeCoverageAggregate' });
export type ApexCodeCoverageAggregate = typeof ApexCodeCoverageAggregateSchema.Type;

export const ApexOrgWideCoverageSchema = Schema.Struct({
  done: Schema.Boolean,
  totalSize: Schema.Number,
  records: Schema.mutable(Schema.Array(Schema.Struct({ PercentCovered: Schema.String })))
})
  .annotate({ identifier: 'ApexOrgWideCoverage' });
export type ApexOrgWideCoverage = typeof ApexOrgWideCoverageSchema.Type;

export const ApexOrgWideCoverageQueryRecordSchema = Schema.Struct({
  PercentCovered: CoveragePercentSchema
}).annotate({ identifier: 'ApexOrgWideCoverageRecord' });
