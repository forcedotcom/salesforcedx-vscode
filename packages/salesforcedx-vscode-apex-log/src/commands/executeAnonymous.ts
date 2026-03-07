/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { type EditorService } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { saveExecResult } from '../logs/logStorage';
import { nls } from '../messages';
import { AllServicesLayer } from '../services/extensionProvider';

type EditorContext = Effect.Effect.Success<ReturnType<EditorService['getActiveEditorContext']>>;

const executeAnonymous = Effect.fn('ApexLog.ExecuteAnonymous.executeAnonymous')(function* (context: EditorContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ExecuteAnonymousService.clearDiagnostics(context.documentUri);
  const { result, logBody, logId } = yield* api.services.ExecuteAnonymousService.executeAndRetrieveLog(context.text);
  // Compile error: skip log save, show compileProblem in error notification
  if (!result.compiled) {
    yield* api.services.ExecuteAnonymousService.reportExecResult(
      result,
      context.documentUri,
      context.selectionRange?.startLine
    );
    yield* Effect.sync(() => {
      void vscode.window.showErrorMessage(
        nls.localize(
          'exec_anon_compile_error',
          String(result.line ?? 1),
          String(result.column ?? 1),
          result.compileProblem ?? nls.localize('exec_anon_compile_unknown')
        )
      );
    });
    return result;
  }

  yield* api.services.ExecuteAnonymousService.reportExecResult(
    result,
    context.documentUri,
    context.selectionRange?.startLine
  );
  const logUri = yield* saveExecResult(context.text, result, logBody, logId);
  yield* Effect.sync(() => {
    void vscode.window
      .showInformationMessage(nls.localize('exec_anon_success'), nls.localize('open_log'))
      .then(
        selected =>
          selected === nls.localize('open_log') && void vscode.window.showTextDocument(URI.parse(logUri.toString()))
      );
  });
  return result;
});

const runWithProgress = (context: EditorContext) =>
  Effect.promise(() =>
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: nls.localize('exec_anon_progress_title'),
        cancellable: false
      },
      () => Effect.runPromise(executeAnonymous(context).pipe(Effect.provide(AllServicesLayer)))
    )
  );

export const executeAnonymousCommand = Effect.fn('ApexLog.Command.executeAnonymous')(function* (
  selectionOnly: boolean
) {
  yield* Effect.annotateCurrentSpan({ selectionOnly });
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const context = yield* api.services.EditorService.getActiveEditorContext(selectionOnly);
  return yield* runWithProgress(context);
});
