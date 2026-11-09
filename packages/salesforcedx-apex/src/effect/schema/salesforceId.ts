/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexClassId, ApexTestSuiteId, SalesforceId } from '../../schemas/salesforceId';

/** Salesforce DebugLevel record ID. */
export const DebugLevelId = SalesforceId.pipe(
  Schema.startsWith('7dl'),
  Schema.brand('@salesforcedx-apex/DebugLevelId')
);
export type DebugLevelId = typeof DebugLevelId.Type;

/** Salesforce TraceFlag record ID. */
export const TraceFlagId = SalesforceId.pipe(Schema.startsWith('7tf'), Schema.brand('@salesforcedx-apex/TraceFlagId'));
export type TraceFlagId = typeof TraceFlagId.Type;

export const ApexClassIdsSchema = Schema.compose(Schema.split(','), Schema.Array(ApexClassId)).annotations({
  description: 'a comma-separated list of 15- or 18-character ApexClass IDs'
});
export const ApexTestSuiteIdsSchema = Schema.compose(Schema.split(','), Schema.Array(ApexTestSuiteId)).annotations({
  description: 'a comma-separated list of 15- or 18-character ApexTestSuite IDs'
});
