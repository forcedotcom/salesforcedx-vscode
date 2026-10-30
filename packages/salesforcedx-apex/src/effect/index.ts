/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { ExecuteAnonymousOptionsSchema, ExecuteAnonymousOutcomeSchema, executeAnonymous } from './executeAnonymous.js';
export type { ExecuteAnonymousOptions, ExecuteAnonymousOutcome } from './executeAnonymous.js';
export {
  ApexCompileError,
  ApexOperationError,
  ApexResponseDecodeError,
  ApexRuntimeError,
  causeMessage
} from './errors.js';
