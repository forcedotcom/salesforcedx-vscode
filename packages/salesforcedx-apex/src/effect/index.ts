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
export {
  ApexLogListItem,
  ListLogsOptionsSchema,
  LogStreamEventSchema,
  ApexLogQueryError,
  ApexLogBodyFetchError,
  listLogs,
  getLogBody,
  streamLogs
} from './logs';
export { QueryPageSchema } from './schema/queryPage';
export type { ListLogsOptions, LogStreamEvent, StreamLogsOptions } from './logs';
export { BuildSyncPayloadOptionsSchema, BuildAsyncPayloadOptionsSchema } from './schema/testPayloads';
export type { BuildSyncPayloadOptions, BuildAsyncPayloadOptions } from './schema/testPayloads';
export { buildSyncPayload, buildAsyncPayload } from './testPayloads';
export { TestSuiteSchema, TestSuiteMembershipSchema } from './schema/testSuites';
export type { TestSuite, TestSuiteMembership } from './schema/testSuites';
export { retrieveAllSuites, getTestsInSuite, buildSuite } from './testSuites';
