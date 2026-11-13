/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ErrorHandlerService } from './errorHandlerService.js';
import type { UserCancellationError } from './errors.js';
import type { ExtensionContextService } from './extensionContextService.js';
import type * as Effect from 'effect/Effect';
import type * as ManagedRuntime from 'effect/ManagedRuntime';

export type RegisterCommandWithRuntime = <R, RuntimeError>(
  runtime: ManagedRuntime.ManagedRuntime<R, RuntimeError>
) => <Args extends readonly unknown[], A, E>(
  command: string,
  handler: (...args: Args) => Effect.Effect<A, E | UserCancellationError, R>
) => Effect.Effect<void, never, ExtensionContextService | ErrorHandlerService>;
