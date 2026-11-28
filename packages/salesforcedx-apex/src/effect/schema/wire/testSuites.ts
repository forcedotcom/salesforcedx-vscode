/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';
import { ApexClassId, ApexTestSuiteId, ApexTestSuiteIdString } from '../salesforceId.js';
import { TestSuiteSchema } from '../testSuites.js';

export const TestSuiteIdQueryResponseSchema = Schema.Struct({ Id: ApexTestSuiteId });
export const ApexClassIdQueryResponseSchema = Schema.Struct({ Id: ApexClassId });

export const TestSuiteRecordSchema = Schema.Union([
  TestSuiteSchema,
  Schema.Struct({ Id: ApexTestSuiteIdString, TestSuiteName: Schema.String })
]).pipe(
  Schema.decodeTo(TestSuiteSchema, {
    decode: SchemaGetter.transform(record => ({
      id: 'id' in record ? record.id : record.Id,
      TestSuiteName: record.TestSuiteName
    })),
    encode: SchemaGetter.transform(suite => ({ Id: suite.id, TestSuiteName: suite.TestSuiteName }))
  })
);
