/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexClassIdString } from '../../../schemas/salesforceId';
import {
  ApexClassOrTriggerIdSchema,
  CoverageLineCountSchema,
  CoverageLinesSchema,
  CoveragePercentSchema
} from '../coverage';

const ApexClassOrTriggerSchema = Schema.Struct({ Id: ApexClassOrTriggerIdSchema, Name: Schema.String }).pipe(
  Schema.mutable
);

export const ApexCodeCoverageRecordSchema = Schema.Struct({
  ApexClassOrTrigger: ApexClassOrTriggerSchema,
  ApexTestClassId: ApexClassIdString,
  TestMethodName: Schema.String,
  NumLinesCovered: CoverageLineCountSchema,
  NumLinesUncovered: CoverageLineCountSchema,
  Coverage: Schema.optional(CoverageLinesSchema)
})
  .pipe(Schema.mutable)
  .annotations({ identifier: 'ApexCodeCoverageRecord' });
export type ApexCodeCoverageRecord = typeof ApexCodeCoverageRecordSchema.Type;

export const ApexCodeCoverageSchema = Schema.Struct({
  done: Schema.Boolean,
  totalSize: Schema.Number,
  records: Schema.mutable(Schema.Array(ApexCodeCoverageRecordSchema))
})
  .pipe(Schema.mutable)
  .annotations({ identifier: 'ApexCodeCoverage' });
export type ApexCodeCoverage = typeof ApexCodeCoverageSchema.Type;

export const ApexCodeCoverageAggregateRecordSchema = Schema.Struct({
  ApexClassOrTrigger: ApexClassOrTriggerSchema,
  NumLinesCovered: CoverageLineCountSchema,
  NumLinesUncovered: CoverageLineCountSchema,
  Coverage: CoverageLinesSchema
})
  .pipe(Schema.mutable)
  .annotations({ identifier: 'ApexCodeCoverageAggregateRecord' });
export type ApexCodeCoverageAggregateRecord = typeof ApexCodeCoverageAggregateRecordSchema.Type;

export const ApexCodeCoverageAggregateSchema = Schema.Struct({
  done: Schema.Boolean,
  totalSize: Schema.Number,
  records: Schema.mutable(Schema.Array(ApexCodeCoverageAggregateRecordSchema))
})
  .pipe(Schema.mutable)
  .annotations({ identifier: 'ApexCodeCoverageAggregate' });
export type ApexCodeCoverageAggregate = typeof ApexCodeCoverageAggregateSchema.Type;

export const ApexOrgWideCoverageSchema = Schema.Struct({
  done: Schema.Boolean,
  totalSize: Schema.Number,
  records: Schema.mutable(Schema.Array(Schema.Struct({ PercentCovered: Schema.String }).pipe(Schema.mutable)))
})
  .pipe(Schema.mutable)
  .annotations({ identifier: 'ApexOrgWideCoverage' });
export type ApexOrgWideCoverage = typeof ApexOrgWideCoverageSchema.Type;

export const ApexOrgWideCoverageQueryRecordSchema = Schema.Struct({
  PercentCovered: CoveragePercentSchema
}).annotations({ identifier: 'ApexOrgWideCoverageRecord' });
