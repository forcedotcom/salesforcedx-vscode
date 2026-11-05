/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';
import { ApexClassIdString, ApexTriggerIdString } from './salesforceId.js';

export const ApexClassOrTriggerIdSchema = Schema.Union([ApexClassIdString, ApexTriggerIdString]);

const coverageLineCountMessage = 'Coverage line counts must be non-negative integers';
const coverageLineNumberMessage = 'Coverage line numbers must be positive integers';
const coveragePercentMessage = 'Coverage percentage must be a finite number from 0 to 100';

export const CoverageLineCountSchema = Schema.Number.check(
  Schema.isFinite({ message: coverageLineCountMessage }),
  Schema.isInt({ message: coverageLineCountMessage }),
  Schema.isGreaterThanOrEqualTo(0, { message: coverageLineCountMessage })
).annotate({ identifier: 'CoverageLineCount' });

const CoverageLineNumberSchema = Schema.Number.check(
  Schema.isFinite({ message: coverageLineNumberMessage }),
  Schema.isInt({ message: coverageLineNumberMessage }),
  Schema.isGreaterThan(0, { message: coverageLineNumberMessage })
).annotate({ identifier: 'CoverageLineNumber' });

/** Tooling returns a number; older clients supply its string representation. */
const CoveragePercentStringSchema = Schema.String.check(
  Schema.isPattern(/^\s*(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?\s*$/, { message: coveragePercentMessage })
).pipe(
  Schema.decodeTo(Schema.Number, {
    decode: SchemaGetter.transform(Number),
    encode: SchemaGetter.transform(String)
  })
);

export const CoveragePercentSchema = Schema.Union([Schema.Number, CoveragePercentStringSchema])
  .check(
    Schema.isFinite({ message: coveragePercentMessage }),
    Schema.isGreaterThanOrEqualTo(0, { message: coveragePercentMessage }),
    Schema.isLessThanOrEqualTo(100, { message: coveragePercentMessage })
  )
  .annotate({ identifier: 'CoveragePercent' });

export const CoverageNumberArraySchema = CoverageLineNumberSchema.pipe(Schema.Array, Schema.mutable);
export const CoverageLinesSchema = Schema.Struct({
  coveredLines: CoverageNumberArraySchema,
  uncoveredLines: CoverageNumberArraySchema
});
