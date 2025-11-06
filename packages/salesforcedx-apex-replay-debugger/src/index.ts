/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export {
  SEND_METRIC_GENERAL_EVENT,
  SEND_METRIC_ERROR_EVENT,
  EXTENT_TRIGGER_PREFIX,
  SEND_METRIC_LAUNCH_EVENT,
  OVERLAY_ACTION_DELETE_URL,
  SOBJECTS_URL,
  COMPOSITE_BATCH_URL,
  QUERY_URL
} from './constants';

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

export { breakpointUtil } from './breakpoints';
export { OrgInfoError } from './commands';
