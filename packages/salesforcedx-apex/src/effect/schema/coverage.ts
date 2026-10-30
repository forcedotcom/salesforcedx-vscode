/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexClassIdString, ApexTriggerIdString } from '../../schemas/salesforceId.js';

export const ApexClassOrTriggerIdSchema = Schema.Union([ApexClassIdString, ApexTriggerIdString]);

export const CoverageLineCountSchema = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0, { message: 'Coverage line counts must be non-negative integers' })
).annotate({ identifier: 'CoverageLineCount' });

const CoverageLineNumberSchema = Schema.Int.check(
  Schema.isGreaterThan(0, { message: 'Coverage line numbers must be positive integers' })
).annotate({ identifier: 'CoverageLineNumber' });

/** Tooling returns a number; older clients supply its string representation. */
export const CoveragePercentSchema = Schema.Union([Schema.Finite, Schema.NumberFromString]).check(
  Schema.isGreaterThanOrEqualTo(0, { message: 'Coverage percentage must be a finite number from 0 to 100' }),
  Schema.isLessThanOrEqualTo(100, { message: 'Coverage percentage must be a finite number from 0 to 100' })
)
  .annotate({
    identifier: 'CoveragePercent'
  });

export const CoverageNumberArraySchema = CoverageLineNumberSchema.pipe(Schema.Array, Schema.mutable);
export const CoverageLinesSchema = Schema.Struct({
  coveredLines: CoverageNumberArraySchema,
  uncoveredLines: CoverageNumberArraySchema
});
