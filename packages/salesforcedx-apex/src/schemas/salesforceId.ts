/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

const SalesforceIdString = Schema.String.pipe(Schema.pattern(/^(?:[A-Za-z0-9]{15}|[A-Za-z0-9]{18})$/));
const prefixedSalesforceIdString = (prefix: string, recordType: string) =>
  SalesforceIdString.pipe(Schema.startsWith(prefix)).annotations({
    identifier: `${recordType}Id`,
    message: () => ({
      message: `${recordType} ID must contain 15 or 18 alphanumeric characters and start with ${prefix}`,
      override: true
    })
  });

/** A 15- or 18-character alphanumeric Salesforce record ID. */
export const SalesforceId = SalesforceIdString.pipe(Schema.brand('@salesforcedx-apex/SalesforceId'));
export type SalesforceId = typeof SalesforceId.Type;

/** Salesforce User record ID. */
export const UserIdString = prefixedSalesforceIdString('005', 'User');
export const UserId = UserIdString.pipe(Schema.brand('@salesforcedx-apex/UserId'));
export type UserId = typeof UserId.Type;

/** Salesforce Organization record ID. */
export const OrgIdString = prefixedSalesforceIdString('00D', 'Organization');

/** Salesforce ApexClass record ID. */
export const ApexClassIdString = prefixedSalesforceIdString('01p', 'ApexClass');
export const ApexClassId = ApexClassIdString.pipe(Schema.brand('@salesforcedx-apex/ApexClassId'));
export type ApexClassId = typeof ApexClassId.Type;

/** Salesforce ApexTrigger record ID. */
export const ApexTriggerIdString = prefixedSalesforceIdString('01q', 'ApexTrigger');
export const ApexTriggerId = ApexTriggerIdString.pipe(Schema.brand('@salesforcedx-apex/ApexTriggerId'));
export type ApexTriggerId = typeof ApexTriggerId.Type;

/** Salesforce Tooling API ApexLog record ID. */
export const ApexLogIdString = prefixedSalesforceIdString('07L', 'ApexLog');
export const ApexLogId = ApexLogIdString.pipe(Schema.brand('@salesforcedx-apex/ApexLogId'));
export type ApexLogId = typeof ApexLogId.Type;

/** Salesforce Apex test run ID. */
export const TestRunIdString = prefixedSalesforceIdString('707', 'AsyncApexJob');
export const TestRunId = TestRunIdString.pipe(Schema.brand('@salesforcedx-apex/TestRunId'));
export type TestRunId = typeof TestRunId.Type;

/** Salesforce ApexTestSuite record ID. */
export const ApexTestSuiteIdString = prefixedSalesforceIdString('05F', 'ApexTestSuite');
export const ApexTestSuiteId = ApexTestSuiteIdString.pipe(Schema.brand('@salesforcedx-apex/ApexTestSuiteId'));
export type ApexTestSuiteId = typeof ApexTestSuiteId.Type;

/** Salesforce Apex test result ID. */
export const ApexTestResultIdString = prefixedSalesforceIdString('07M', 'ApexTestResult');

/** Salesforce Flow test result ID. */
export const FlowTestResultIdString = prefixedSalesforceIdString('2hU', 'FlowTestResult');

/** Salesforce Apex test queue item ID. */
export const ApexTestQueueItemIdString = prefixedSalesforceIdString('709', 'ApexTestQueueItem');
export const ApexTestQueueItemId = ApexTestQueueItemIdString.pipe(
  Schema.brand('@salesforcedx-apex/ApexTestQueueItemId')
);
export type ApexTestQueueItemId = typeof ApexTestQueueItemId.Type;
