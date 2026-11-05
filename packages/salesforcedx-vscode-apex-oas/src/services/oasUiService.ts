/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Runtime from 'effect/Runtime';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { OasUiRequestFailed } from '../errors';
import { nls } from '../messages/nls';

export class OasUiService extends Effect.Service<OasUiService>()('OasUiService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const chooseExistingEsrAction = Effect.fn('OasUiService.chooseExistingEsrAction')(function* () {
      return yield* Effect.tryPromise({
        try: () =>
          vscode.window.showWarningMessage(
            nls.localize('file_exists'),
            { modal: true },
            nls.localize('overwrite'),
            nls.localize('merge')
          ),
        catch: cause => new OasUiRequestFailed({ message: 'Failed to show existing ESR prompt', cause })
      });
    });

    const openDiff = Effect.fn('OasUiService.openDiff')(function* (left: URI, right: URI, title: string) {
      yield* Effect.tryPromise({
        try: () => vscode.commands.executeCommand('vscode.diff', left, right, title),
        catch: cause => new OasUiRequestFailed({ message: 'Failed to open ESR diff', cause })
      });
    });

    const withSteppedProgress =
      (title: string, location: vscode.ProgressLocation = vscode.ProgressLocation.Notification) =>
      <A, E, R>(body: (report: (message: string) => Effect.Effect<void>) => Effect.Effect<A, E, R>) =>
        Effect.runtime<R>().pipe(
          Effect.flatMap(runtime =>
            Effect.async<A, E>(resume => {
              void vscode.window.withProgress({ location, title, cancellable: false }, progress => {
                const report = (message: string) => Effect.sync(() => progress.report({ message }));
                return Runtime.runPromiseExit(runtime)(body(report)).then(exit => {
                  resume(exit._tag === 'Success' ? Effect.succeed(exit.value) : Effect.failCause(exit.cause));
                });
              });
            })
          )
        );

    return { chooseExistingEsrAction, openDiff, withSteppedProgress };
  })
}) {}
