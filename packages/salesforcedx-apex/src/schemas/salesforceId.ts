/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/** A 15- or 18-character alphanumeric Salesforce record ID. */
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

/** Salesforce ApexTrigger record ID. */
export const ApexTriggerId = SalesforceId.pipe(
  Schema.startsWith('01q'),
  Schema.brand('@salesforcedx-apex/ApexTriggerId')
);
export type ApexTriggerId = typeof ApexTriggerId.Type;

/** Salesforce Tooling API ApexLog record ID. */
export const ApexLogId = SalesforceId.pipe(Schema.startsWith('07L'), Schema.brand('@salesforcedx-apex/ApexLogId'));
export type ApexLogId = typeof ApexLogId.Type;

/** Salesforce Apex test run ID. */
export const TestRunId = SalesforceId.pipe(Schema.startsWith('707'), Schema.brand('@salesforcedx-apex/TestRunId'));
export type TestRunId = typeof TestRunId.Type;
