/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

// Keep the mutable arrays and string IDs accepted by existing coverage consumers.
const NumberArray = Schema.Number.pipe(Schema.Array, Schema.mutable);
const CoverageLinesSchema = Schema.Struct({
  coveredLines: NumberArray,
  uncoveredLines: NumberArray
}).pipe(Schema.mutable);
const ApexClassOrTriggerSchema = Schema.Struct({ Id: Schema.String, Name: Schema.String }).pipe(Schema.mutable);

export const ApexCodeCoverageRecordSchema = Schema.Struct({
  ApexClassOrTrigger: ApexClassOrTriggerSchema,
  ApexTestClassId: Schema.String,
  TestMethodName: Schema.String,
  NumLinesCovered: Schema.Number,
  NumLinesUncovered: Schema.Number,
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
  NumLinesCovered: Schema.Number,
  NumLinesUncovered: Schema.Number,
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

export const PerClassCoverageSchema = Schema.Struct({
  apexClassOrTriggerName: Schema.String,
  apexClassOrTriggerId: Schema.String,
  apexTestClassId: Schema.String,
  apexTestMethodName: Schema.String,
  numLinesCovered: Schema.Number,
  numLinesUncovered: Schema.Number,
  percentage: Schema.String,
  coverage: Schema.optional(CoverageLinesSchema)
})
  .pipe(Schema.mutable)
  .annotations({ identifier: 'PerClassCoverage' });
export type PerClassCoverage = typeof PerClassCoverageSchema.Type;

export const CodeCoverageResultSchema = Schema.Struct({
  apexId: Schema.String,
  name: Schema.String,
  type: Schema.Literal('ApexClass', 'ApexTrigger'),
  numLinesCovered: Schema.Number,
  numLinesUncovered: Schema.Number,
  percentage: Schema.String,
  coveredLines: NumberArray,
  uncoveredLines: NumberArray
})
  .pipe(Schema.mutable)
  .annotations({ identifier: 'CodeCoverageResult' });
export type CodeCoverageResult = typeof CodeCoverageResultSchema.Type;

export const AggregateCodeCoverageResultSchema = Schema.Struct({
  codeCoverageResults: Schema.mutable(Schema.Array(CodeCoverageResultSchema)),
  totalLines: Schema.Number,
  coveredLines: Schema.Number
})
  .pipe(Schema.mutable)
  .annotations({ identifier: 'AggregateCodeCoverageResult' });
export type AggregateCodeCoverageResult = typeof AggregateCodeCoverageResultSchema.Type;
