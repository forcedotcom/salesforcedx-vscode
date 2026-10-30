/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';
import { ApexTestSuiteId, TestRunIdString } from '../../schemas/salesforceId.js';

/** A 15- or 18-character Salesforce record ID. */
export const SalesforceId = Schema.String.check(Schema.isPattern(/^(?:[A-Za-z0-9]{15}|[A-Za-z0-9]{18})$/)).pipe(
  Schema.brand('@salesforcedx-apex/SalesforceId')
);
export type SalesforceId = typeof SalesforceId.Type;

/** Salesforce ApexClass record ID. */
export const ApexClassId = SalesforceId.check(Schema.isStartingWith('01p')).pipe(
  Schema.brand('@salesforcedx-apex/ApexClassId')
);
export type ApexClassId = typeof ApexClassId.Type;

/** Salesforce Apex test run ID. */
export const TestRunId = TestRunIdString.pipe(Schema.brand('@salesforcedx-apex/TestRunId'));
export type TestRunId = typeof TestRunId.Type;

export const ApexClassIdsSchema = Schema.String.pipe(
  Schema.decodeTo(Schema.Array(ApexClassId), {
    decode: SchemaGetter.transform(value => value.split(',')),
    encode: SchemaGetter.transform(values => values.join(','))
  })
).annotate({ description: 'a comma-separated list of 15- or 18-character ApexClass IDs' });
export const ApexTestSuiteIdsSchema = Schema.String.pipe(
  Schema.decodeTo(Schema.Array(ApexTestSuiteId), {
    decode: SchemaGetter.transform(value => value.split(',')),
    encode: SchemaGetter.transform(values => values.join(','))
  })
).annotate({ description: 'a comma-separated list of 15- or 18-character ApexTestSuite IDs' });
