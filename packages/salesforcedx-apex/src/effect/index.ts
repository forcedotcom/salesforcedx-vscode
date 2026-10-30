/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { ExecuteAnonymousOptionsSchema, ExecuteAnonymousOutcomeSchema, executeAnonymous } from './executeAnonymous';
export type { ExecuteAnonymousOptions, ExecuteAnonymousOutcome } from './executeAnonymous';
export {
  ApexCompileError,
  ApexOperationError,
  ApexResponseDecodeError,
  ApexRuntimeError,
  causeMessage
} from './errors';
export { listLogs, getLogBody, streamLogs } from './logs';
export { ApexLogQueryError, ApexLogBodyFetchError } from './schema/errors';
export { ApexLogListItem } from './schema/wire/logs';
export { ListLogsOptionsSchema, LogStreamEventSchema } from './schema/logs';
export { QueryPageSchema } from './schema/queryPage';
export type { ListLogsOptions } from './schema/logs';
export type { LogStreamEvent, StreamLogsOptions } from './logs';
