/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexClassIdString, ApexTriggerIdString } from '../../schemas/salesforceId';

export const ApexClassOrTriggerIdSchema = Schema.Union(ApexClassIdString, ApexTriggerIdString);

export const CoverageLineCountSchema = Schema.NonNegativeInt.annotations({
  identifier: 'CoverageLineCount',
  message: () => ({ message: 'Coverage line counts must be non-negative integers', override: true })
});

const CoverageLineNumberSchema = Schema.Int.pipe(Schema.positive()).annotations({
  identifier: 'CoverageLineNumber',
  message: () => ({ message: 'Coverage line numbers must be positive integers', override: true })
});

/** Tooling returns a number; older clients supply its string representation. */
export const CoveragePercentSchema = Schema.Union(Schema.Number, Schema.NumberFromString)
  .pipe(Schema.finite(), Schema.between(0, 100))
  .annotations({
    identifier: 'CoveragePercent',
    message: () => ({ message: 'Coverage percentage must be a finite number from 0 to 100', override: true })
  });

export const CoverageNumberArraySchema = CoverageLineNumberSchema.pipe(Schema.Array, Schema.mutable);
export const CoverageLinesSchema = Schema.Struct({
  coveredLines: CoverageNumberArraySchema,
  uncoveredLines: CoverageNumberArraySchema
}).pipe(Schema.mutable);
