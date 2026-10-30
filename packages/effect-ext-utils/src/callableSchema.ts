/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/**
 * Build a schema that checks whether a value is callable, retaining the supplied
 * TypeScript function signature. It does not call or wrap the function, validate
 * its arguments or return value, or bind its receiver.
 *
 * Use an extension's exported API type to describe only the methods you need,
 * alongside ordinary Effect schemas for other exported values.
 *
 * @example
 * const schema = Schema.Struct({
 *   getLineBreakpointInfo: CallableSchema<ApexVSCodeApi['getLineBreakpointInfo']>()
 * });
 *
 * const api = yield* getExtensionExports({
 *   extId: 'salesforce.salesforcedx-vscode-apex',
 *   schema
 * });
 */
export const CallableSchema = <F extends (...args: never[]) => unknown>() =>
  Schema.declare((value): value is F => typeof value === 'function', { identifier: 'Function' });
