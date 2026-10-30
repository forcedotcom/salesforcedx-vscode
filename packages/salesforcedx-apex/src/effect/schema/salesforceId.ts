/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/** A 15- or 18-character Salesforce record ID. */
export const SalesforceId = Schema.String.pipe(
  Schema.pattern(/^(?:[A-Za-z0-9]{15}|[A-Za-z0-9]{18})$/),
  Schema.brand('@salesforcedx-apex/SalesforceId')
);
export type SalesforceId = typeof SalesforceId.Type;

/** Salesforce ApexClass record ID. */
export const ApexClassId = SalesforceId.pipe(Schema.startsWith('01p'), Schema.brand('@salesforcedx-apex/ApexClassId'));
export type ApexClassId = typeof ApexClassId.Type;

/** Salesforce Apex test run ID. */
export const TestRunId = SalesforceId.pipe(Schema.startsWith('707'), Schema.brand('@salesforcedx-apex/TestRunId'));
export type TestRunId = typeof TestRunId.Type;

const apexClassIdPattern = '01p[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?';
const apexTestSuiteIdPattern = '05F[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?';

export const ApexClassIdsSchema = Schema.String.pipe(
  Schema.pattern(new RegExp(`^${apexClassIdPattern}(?:,${apexClassIdPattern})*$`, 'u'))
);

export const ApexTestSuiteIdsSchema = Schema.String.pipe(
  Schema.pattern(new RegExp(`^${apexTestSuiteIdPattern}(?:,${apexTestSuiteIdPattern})*$`, 'u'))
);
