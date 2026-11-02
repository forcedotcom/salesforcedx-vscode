/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { SalesforceId } from '../../schemas/salesforceId';

export const TestSuiteSchema = Schema.Struct({ id: SalesforceId, TestSuiteName: Schema.String }).annotations({
  identifier: 'TestSuite'
});
export type TestSuite = typeof TestSuiteSchema.Type;

export const TestSuiteMembershipSchema = Schema.Struct({ ApexClassId: SalesforceId }).annotations({
  identifier: 'TestSuiteMembership'
});
export type TestSuiteMembership = typeof TestSuiteMembershipSchema.Type;
