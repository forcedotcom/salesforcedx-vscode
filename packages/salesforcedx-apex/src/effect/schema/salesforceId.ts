/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexTestSuiteId, TestRunIdString } from '../../schemas/salesforceId';

/** A 15- or 18-character Salesforce record ID. */
export const SalesforceId = Schema.String.pipe(
  Schema.pattern(/^(?:[A-Za-z0-9]{15}|[A-Za-z0-9]{18})$/),
  Schema.brand('@salesforcedx-apex/SalesforceId')
);
export type SalesforceId = typeof SalesforceId.Type;

/** Salesforce User record ID. */
export const UserId = SalesforceId.pipe(Schema.startsWith('005'), Schema.brand('@salesforcedx-apex/UserId'));
export type UserId = typeof UserId.Type;

/** Salesforce ApexClass record ID. */
export const ApexClassId = SalesforceId.pipe(Schema.startsWith('01p'), Schema.brand('@salesforcedx-apex/ApexClassId'));
export type ApexClassId = typeof ApexClassId.Type;

/** Salesforce DebugLevel record ID. */
export const DebugLevelId = SalesforceId.pipe(
  Schema.startsWith('7dl'),
  Schema.brand('@salesforcedx-apex/DebugLevelId')
);
export type DebugLevelId = typeof DebugLevelId.Type;

/** Salesforce TraceFlag record ID. */
export const TraceFlagId = SalesforceId.pipe(Schema.startsWith('7tf'), Schema.brand('@salesforcedx-apex/TraceFlagId'));
export type TraceFlagId = typeof TraceFlagId.Type;

/** Salesforce Apex test run ID. */
export const TestRunId = TestRunIdString.pipe(Schema.brand('@salesforcedx-apex/TestRunId'));
export type TestRunId = typeof TestRunId.Type;

export const ApexClassIdsSchema = Schema.compose(Schema.split(','), Schema.Array(ApexClassId)).annotations({
  description: 'a comma-separated list of 15- or 18-character ApexClass IDs'
});
export const ApexTestSuiteIdsSchema = Schema.compose(Schema.split(','), Schema.Array(ApexTestSuiteId)).annotations({
  description: 'a comma-separated list of 15- or 18-character ApexTestSuite IDs'
});
