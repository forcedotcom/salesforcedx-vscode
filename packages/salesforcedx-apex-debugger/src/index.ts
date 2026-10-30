/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Define the metric payload sent to the debugger extension.
type Metric = {
  subject: string;
  type: string;
};

// Type guard to check if the object conforms to Metric
export const isMetric = (input: unknown): input is Metric =>
  !!input &&
  Object.keys(input).every(key => ['subject', 'type'].includes(key)) &&
  Object.values(input).every(value => typeof value === 'string');
