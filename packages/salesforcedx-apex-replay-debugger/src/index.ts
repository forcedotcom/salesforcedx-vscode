/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export {
  SEND_METRIC_GENERAL_EVENT,
  SEND_METRIC_ERROR_EVENT,
  EXTENT_TRIGGER_PREFIX,
  SEND_METRIC_LAUNCH_EVENT
} from './constants';
export { breakpointUtil } from './breakpoints/index';
export type { OrgInfoError } from './commands/index';
export { extractHeapDumpIdsFromLog } from './core/extractHeapDumpIds';
export type { HeapDumpLogEntry } from './core/extractHeapDumpIds';
export { extractAnonApexSource } from './core/logContextUtil';
export { extractSourceTypesFromLog, getSourceUri } from './core/sourceUriMapping';
export type { HeapDumpResult } from './adapter/types';
export type { ApexExecutionOverlayResultCommandSuccess } from './commands/apexExecutionOverlayResultCommand';

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
