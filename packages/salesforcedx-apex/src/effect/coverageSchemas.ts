/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexClassIdString } from '../schemas/salesforceId';
import {
  ApexClassOrTriggerIdSchema,
  CoverageLineCountSchema,
  CoverageLinesSchema,
  CoverageNumberArraySchema
} from './schema/coverage';

// Keep the mutable arrays and string IDs accepted by existing coverage consumers.

export const PerClassCoverageSchema = Schema.Struct({
  apexClassOrTriggerName: Schema.String,
  apexClassOrTriggerId: ApexClassOrTriggerIdSchema,
  apexTestClassId: ApexClassIdString,
  apexTestMethodName: Schema.String,
  numLinesCovered: CoverageLineCountSchema,
  numLinesUncovered: CoverageLineCountSchema,
  percentage: Schema.String,
  coverage: Schema.optional(CoverageLinesSchema)
})
  .pipe(Schema.mutable)
  .annotations({ identifier: 'PerClassCoverage' });
export type PerClassCoverage = typeof PerClassCoverageSchema.Type;

export const CodeCoverageResultSchema = Schema.Struct({
  apexId: ApexClassOrTriggerIdSchema,
  name: Schema.String,
  type: Schema.Literal('ApexClass', 'ApexTrigger'),
  numLinesCovered: CoverageLineCountSchema,
  numLinesUncovered: CoverageLineCountSchema,
  percentage: Schema.String,
  coveredLines: CoverageNumberArraySchema,
  uncoveredLines: CoverageNumberArraySchema
})
  .pipe(Schema.mutable)
  .annotations({ identifier: 'CodeCoverageResult' });
export type CodeCoverageResult = typeof CodeCoverageResultSchema.Type;

export const AggregateCodeCoverageResultSchema = Schema.Struct({
  codeCoverageResults: Schema.mutable(Schema.Array(CodeCoverageResultSchema)),
  totalLines: CoverageLineCountSchema,
  coveredLines: CoverageLineCountSchema
})
  .pipe(Schema.mutable)
  .annotations({ identifier: 'AggregateCodeCoverageResult' });
export type AggregateCodeCoverageResult = typeof AggregateCodeCoverageResultSchema.Type;
