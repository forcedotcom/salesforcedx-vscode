/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mutable } from '../utils/mutable.js';
import * as Schema from 'effect/Schema';
import {
  ApexClassOrTriggerIdSchema,
  CoverageLineCountSchema,
  CoverageLinesSchema,
  CoverageNumberArraySchema
} from './schema/coverage.js';
import { ApexClassIdString } from './schema/salesforceId.js';

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
}).annotate({ identifier: 'PerClassCoverage' });
export type PerClassCoverage = Mutable<typeof PerClassCoverageSchema.Type>;

export const CodeCoverageResultSchema = Schema.Struct({
  apexId: ApexClassOrTriggerIdSchema,
  name: Schema.String,
  type: Schema.Literals(['ApexClass', 'ApexTrigger']),
  numLinesCovered: CoverageLineCountSchema,
  numLinesUncovered: CoverageLineCountSchema,
  percentage: Schema.String,
  coveredLines: CoverageNumberArraySchema,
  uncoveredLines: CoverageNumberArraySchema
}).annotate({ identifier: 'CodeCoverageResult' });
export type CodeCoverageResult = Mutable<typeof CodeCoverageResultSchema.Type>;

export const AggregateCodeCoverageResultSchema = Schema.Struct({
  codeCoverageResults: Schema.Array(CodeCoverageResultSchema).pipe(Schema.mutable),
  totalLines: CoverageLineCountSchema,
  coveredLines: CoverageLineCountSchema
}).annotate({ identifier: 'AggregateCodeCoverageResult' });
export type AggregateCodeCoverageResult = Mutable<typeof AggregateCodeCoverageResultSchema.Type>;
