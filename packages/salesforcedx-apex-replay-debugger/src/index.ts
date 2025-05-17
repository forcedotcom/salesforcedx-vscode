/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export {
  CHECKPOINT,
  CHECKPOINTS_LOCK_STRING,
  DEBUGGER_LAUNCH_TYPE,
  DEBUGGER_TYPE,
  LIVESHARE_DEBUGGER_TYPE,
  FIELD_INTEGRITY_EXCEPTION,
  SEND_METRIC_GENERAL_EVENT,
  SEND_METRIC_ERROR_EVENT,
  LAST_OPENED_LOG_FOLDER_KEY,
  LAST_OPENED_LOG_KEY,
  EXTENT_TRIGGER_PREFIX,
  SEND_METRIC_LAUNCH_EVENT,
  MAX_ALLOWED_CHECKPOINTS,
  OVERLAY_ACTION_DELETE_URL,
  LIVESHARE_DEBUG_TYPE_REQUEST,
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
export { ActionScriptEnum, OrgInfoError } from './commands';
