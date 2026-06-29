/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { type EditorService } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { saveExecResult } from '../logs/logStorage';
import { nls } from '../messages';
import { getRuntime } from '../services/runtime';
import {
  type ProgressAndSuccessCommandKey,
  getProgressLocation,
  showSuccessNotification
} from '../utils/notificationMode';

type EditorContext = Effect.Effect.Success<ReturnType<EditorService['getActiveEditorContext']>>;

const executeAnonymous = Effect.fn('ApexLog.ExecuteAnonymous.executeAnonymous')(function* (
  context: EditorContext,
  command: ProgressAndSuccessCommandKey
) {
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
    context.selectionRange?.startLine,
    logBody
  );
  const logUri = yield* saveExecResult(context.text, result, logBody, logId);
  yield* Effect.sync(() => {
    showSuccessNotification(command, nls.localize('exec_anon_success'), false, [
      {
        label: nls.localize('open_log'),
        run: () => void getRuntime().runPromise(api.services.FsService.showTextDocument(logUri))
      }
    ]);
  });
  return result;
});

const runWithProgress = (context: EditorContext, command: ProgressAndSuccessCommandKey) =>
  Effect.promise(() =>
    vscode.window.withProgress(
      {
        location: getProgressLocation(command),
        title: nls.localize('exec_anon_progress_title'),
        cancellable: false
      },
      () => getRuntime().runPromise(executeAnonymous(context, command))
    )
  );

export const executeAnonymousCommand = Effect.fn('ApexLog.Command.executeAnonymous')(function* (
  selectionOnly: boolean
) {
  yield* Effect.annotateCurrentSpan({ selectionOnly });
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const context = yield* api.services.EditorService.getActiveEditorContext(selectionOnly);
  const command: ProgressAndSuccessCommandKey = selectionOnly
    ? "SFDX: Execute Anonymous Apex with Editor's Selected Text"
    : 'SFDX: Execute Anonymous Apex with Currently Open Editor';
  return yield* runWithProgress(context, command);
});
