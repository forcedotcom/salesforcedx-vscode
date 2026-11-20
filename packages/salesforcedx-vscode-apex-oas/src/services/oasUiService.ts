/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { OasUiRequestFailed } from '../errors';
import { nls } from '../messages/nls';

export class OasUiService extends Effect.Service<OasUiService>()('OasUiService', {
  accessors: true,
  dependencies: [
    Layer.service(ExtensionProviderService),
    Layer.unwrapEffect(Effect.map(getServicesApi, api => Layer.service(api.services.PromptService)))
  ],
  effect: Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const promptService = yield* api.services.PromptService;

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
        promptService.withProgressReporting({ title, location, cancellable: false })(progress =>
          body(message => Effect.sync(() => progress.report({ message })))
        );

    return { chooseExistingEsrAction, openDiff, withSteppedProgress };
  })
}) {}
