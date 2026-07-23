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
import { ExecAnonCompileError } from '../errors/commandErrors';
import { saveExecResult } from '../logs/logStorage';
import { nls } from '../messages';
import { getRuntime } from '../services/runtime';

type EditorContext = Effect.Effect.Success<ReturnType<EditorService['getActiveEditorContext']>>;

const executeAnonymous = Effect.fn('ApexLog.ExecuteAnonymous.executeAnonymous')(function* (context: EditorContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ExecuteAnonymousService.clearDiagnostics(context.documentUri);
  const { result, logBody, logId } = yield* api.services.ExecuteAnonymousService.executeAndRetrieveLog(context.text);
  // Compile error: skip log save, fail with a tagged error so the standard command error handler shows the notification
  if (!result.compiled) {
    yield* api.services.ExecuteAnonymousService.reportExecResult(
      result,
      context.documentUri,
      context.selectionRange?.startLine
    );
    return yield* Effect.fail(
      new ExecAnonCompileError({
        message: nls.localize(
          'exec_anon_compile_error',
          String(result.line ?? 1),
          String(result.column ?? 1),
          result.compileProblem ?? nls.localize('exec_anon_compile_unknown')
        )
      })
    );
  }

  yield* api.services.ExecuteAnonymousService.reportExecResult(
    result,
    context.documentUri,
    context.selectionRange?.startLine,
    logBody
  );
  return yield* saveExecResult(context.text, result, logBody, logId);
});

export const executeAnonymousCommand = Effect.fn('ApexLog.Command.executeAnonymous')(function* (
  selectionOnly: boolean
) {
  yield* Effect.annotateCurrentSpan({ selectionOnly });
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  // progress dismisses once execution+save resolve; success toast + open-log handled after so the spinner doesn't linger on user interaction
  yield* api.services.EditorService.getActiveEditorContext(selectionOnly).pipe(
    Effect.flatMap(executeAnonymous),
    promptService.withProgress(nls.localize('exec_anon_progress_title')),
    Effect.tap(logUri =>
      Effect.sync(
        () =>
          void vscode.window
            .showInformationMessage(nls.localize('exec_anon_success'), nls.localize('open_log'))
            .then(selected =>
              selected === nls.localize('open_log')
                ? getRuntime().runPromise(api.services.FsService.showTextDocument(logUri))
                : undefined
            )
      )
    )
  );
});
