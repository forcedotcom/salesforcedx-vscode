/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexClassIdString, ApexTriggerIdString } from '../../schemas/salesforceId';

export const ApexClassOrTriggerIdSchema = Schema.Union(ApexClassIdString, ApexTriggerIdString);

export const CoverageNumberArraySchema = Schema.Number.pipe(Schema.Array, Schema.mutable);
export const CoverageLinesSchema = Schema.Struct({
  coveredLines: CoverageNumberArraySchema,
  uncoveredLines: CoverageNumberArraySchema
}).pipe(Schema.mutable);
