/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export const TestSuiteSchema = Schema.Struct({ id: Schema.String, TestSuiteName: Schema.String }).annotations({
  identifier: 'TestSuite'
});
export type TestSuite = typeof TestSuiteSchema.Type;

export const TestSuiteMembershipSchema = Schema.Struct({ ApexClassId: Schema.String }).annotations({
  identifier: 'TestSuiteMembership'
});
export type TestSuiteMembership = typeof TestSuiteMembershipSchema.Type;
