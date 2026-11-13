/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ErrorHandlerService,
  ExtensionContextService,
  type UserCancellationError,
  type RegisterCommandWithRuntime
} from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import type * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';

/** Register in the caller's owned extension scope; the same runtime executes and drains handlers. */
export const registerCommandWithRuntime: RegisterCommandWithRuntime =
  <R, RuntimeError>(runtime: ManagedRuntime.ManagedRuntime<R, RuntimeError>) =>
  <Args extends readonly unknown[], A, E>(
    command: string,
    handler: (...args: Args) => Effect.Effect<A, E | UserCancellationError, R>
  ) =>
    Effect.gen(function* () {
      const context = yield* ExtensionContextService;
      const errors = yield* ErrorHandlerService;
      yield* Effect.acquireRelease(
        Effect.sync(() =>
          vscode.commands.registerCommand(command, (...args: Args) =>
            runtime.runFork(
              Effect.suspend(() => handler(...args)).pipe(
                Effect.withSpan(command, { attributes: { command, argCount: args.length }, root: true }),
                Effect.catchTag('UserCancellationError', () => Effect.void),
                Effect.catchCause(cause => errors.handleCause(cause))
              )
            )
          )
        ),
        registration =>
          Effect.sync(() => {
            registration.dispose();
          })
      ).pipe(Scope.provide(context.scope));
    }).pipe(Effect.withSpan(`registerCommand:${command}`));
