/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Runtime from 'effect/Runtime';
import * as vscode from 'vscode';
import { ErrorHandlerService } from './errorHandlerService';
import { ExtensionContextService } from './extensionContextService';

// TODO: command cancellation...where is that handled?  From inside the effect?  If so, let's create a pattern for it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- This really is that generic, Effect will handle the param stuff
export const registerCommand = <R, E, A>(command: string, f: (...args: any[]) => Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const contextService = yield* ExtensionContextService;
    const context = yield* contextService.getContext;
    const errorHandler = yield* ErrorHandlerService;
    const runtime = yield* Effect.runtime<R>();
    const run = Runtime.runFork(runtime);

    context.subscriptions.push(
      vscode.commands.registerCommand(command, (...args) =>
        f(...args).pipe(
          // command property will be unique to commands
          Effect.withSpan(command, { attributes: { command, args } }),
          Effect.catchAllCause(errorHandler.handleCause),
          run
        )
      )
    );
  });
