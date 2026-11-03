/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexClassId, ApexTestSuiteId, ApexTestSuiteIdString } from '../../../schemas/salesforceId';
import { TestSuiteSchema } from '../testSuites';

export const TestSuiteIdQueryResponseSchema = Schema.Struct({ Id: ApexTestSuiteId });
export const ApexClassIdQueryResponseSchema = Schema.Struct({ Id: ApexClassId });

export const TestSuiteRecordSchema = Schema.Union(
  TestSuiteSchema,
  Schema.Struct({ Id: ApexTestSuiteIdString, TestSuiteName: Schema.String })
).pipe(
  Schema.transform(TestSuiteSchema, {
    strict: true,
    decode: record => ({ id: 'id' in record ? record.id : record.Id, TestSuiteName: record.TestSuiteName }),
    encode: suite => ({ Id: suite.id, TestSuiteName: suite.TestSuiteName })
  })
);
