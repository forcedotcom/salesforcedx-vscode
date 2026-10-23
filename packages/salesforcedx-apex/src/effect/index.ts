/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

<<<<<<< HEAD
export { ExecuteAnonymousOptionsSchema, ExecuteAnonymousResultSchema, executeAnonymous } from './executeAnonymous';
export type { ExecuteAnonymousOptions, ExecuteAnonymousResult } from './executeAnonymous';
export { ApexOperationError, ApexResponseDecodeError, causeMessage } from './errors';
export { AsyncTestOptionsSchema, AsyncTestProgressSchema, runTestAsynchronous } from './asyncTests';
export type {
  AsyncTestOptions,
  AsyncTestPollingOptions,
  AsyncTestProgress,
  AsyncTestRun,
  AsyncTestRunEvent,
  AsyncTestRunSummary
} from './asyncTests';
=======
export { ExecuteAnonymousOptionsSchema, ExecuteAnonymousOutcomeSchema, executeAnonymous } from './executeAnonymous';
export type { ExecuteAnonymousOptions, ExecuteAnonymousOutcome } from './executeAnonymous';
export {
  ApexCompileError,
  ApexOperationError,
  ApexResponseDecodeError,
  ApexRuntimeError,
  causeMessage
} from './errors';
>>>>>>> origin/sm/W-23839366
