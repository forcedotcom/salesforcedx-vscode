/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { ExecuteAnonymousOptionsSchema, ExecuteAnonymousOutcomeSchema, executeAnonymous } from './executeAnonymous';
export type { ExecuteAnonymousOptions, ExecuteAnonymousOutcome } from './executeAnonymous';
export type { SalesforceId } from './salesforceId';
export {
  ApexLogRecordSchema,
  ApexLogCursorSchema,
  ApexLogQueryOptionsSchema,
  ApexLogGetOptionsSchema,
  ApexLogResultSchema,
  ApexLogWithBodySchema,
  listLogs,
  getLogBody,
  getLogRecords,
  getLogs,
  saveLog,
  streamLogs
} from './apexLogs';
export type {
  ApexLogRecord,
  ApexLogCursor,
  ApexLogQueryOptions,
  ApexLogGetOptions,
  ApexLogResult,
  ApexLogWithBody,
  ApexLogWriter
} from './apexLogs';
export {
  ApexCompileError,
  ApexOperationError,
  ApexResponseDecodeError,
  ApexRuntimeError,
  causeMessage
} from './errors';
