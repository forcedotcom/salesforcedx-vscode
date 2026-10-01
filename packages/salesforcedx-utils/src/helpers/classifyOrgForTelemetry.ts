/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type TelemetryClassification = 'gov' | 'nonGov' | 'unknown';

const GOV_POD_PATTERN = /^(?:usa|stg)(?:90|94|99)\d\d/;

export const classifyOrgForTelemetry = (
  orgId: string | undefined,
  instanceName: string | undefined
): TelemetryClassification =>
  orgId && instanceName ? (GOV_POD_PATTERN.test(instanceName) ? 'gov' : 'nonGov') : 'unknown';
