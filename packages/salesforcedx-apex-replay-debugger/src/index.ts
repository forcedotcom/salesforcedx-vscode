/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type MetricLaunch = {
  logSize: number;
  error: MetricError;
};

export type MetricError = {
  subject: string;
  callstack: string;
};

export type MetricGeneral = {
  subject: string;
  type: string;
  qty?: number;
};
