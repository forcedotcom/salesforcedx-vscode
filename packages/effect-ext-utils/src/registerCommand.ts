/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Runtime from 'effect/Runtime';
import * as vscode from 'vscode';
import { getExtensionContext } from './extensionContext';

const hasActions = (e: unknown): e is { actions: string[] } =>
  typeof e === 'object' && e !== null && 'actions' in e && Array.isArray(e.actions);

const hasCause = (e: unknown): e is { cause: unknown } => typeof e === 'object' && e !== null && 'cause' in e;

const getErrorMessage = (error: unknown): string => {
  const extractMessage = (e: unknown): string => {
    if (!(e instanceof Error)) return String(e);

    // SfError and similar have actions array with helpful suggestions
    const actionText = hasActions(e) ? e.actions.filter(Boolean).join('\n') : '';

    // If this error wraps a cause, prefer the cause's message (often more specific)
    const innerCause = hasCause(e) ? e.cause : undefined;
    const baseMessage = innerCause instanceof Error ? extractMessage(innerCause) : e.message;

    return actionText ? `${baseMessage}\n\n${actionText}` : baseMessage;
  };

  return extractMessage(error);
};

// TODO: command cancellation...where is that handled?  From inside the effect?  If so, let's create a pattern for it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- This really is that generic, Effect will handle the param stuff
export const registerCommand = <R, E, A>(command: string, f: (...args: any[]) => Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    console.log('registerCommand', command);
    console.log(f);
    const context = yield* getExtensionContext();
    const runtime = yield* Effect.runtime<R>();
    const run = Runtime.runFork(runtime);

    context.subscriptions.push(
      vscode.commands.registerCommand(command, (...args) =>
        f(...args).pipe(
          // command property will be unique to commands
          Effect.withSpan(command, { attributes: { command, args } }),
          Effect.catchAllCause(genericErrorHandler),
          run
        )
      )
    );
    console.log(context.subscriptions);
  });

const genericErrorHandler = (cause: Cause.Cause<unknown>) => {
  console.error(cause);
  const notificationMessage = getErrorMessage(Cause.squash(cause));
  return Effect.sync(() => void vscode.window.showErrorMessage(notificationMessage));
};
