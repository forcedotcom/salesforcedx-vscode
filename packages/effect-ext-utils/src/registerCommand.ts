/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Runtime from 'effect/Runtime';
import * as vscode from 'vscode';
import { getExtensionContext } from './extensionContext';

export const registerCommand = <R, E, A>(command: string, f: (...args: unknown[]) => Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const context = yield* getExtensionContext();
    const runtime = yield* Effect.runtime<R>();
    const run = Runtime.runFork(runtime);

    context.subscriptions.push(
      vscode.commands.registerCommand(command, (...args) =>
        f(...args).pipe(Effect.catchAllCause(Effect.log), Effect.annotateLogs({ command }), run)
      )
    );
  });
