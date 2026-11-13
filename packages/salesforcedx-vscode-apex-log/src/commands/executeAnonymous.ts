/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ActiveEditorContext } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import { ExecAnonCompileError } from '../errors/commandErrors';
import { saveExecResult } from '../logs/logStorage';
import { nls } from '../messages';
import { getRuntime } from '../services/runtime';
import { type ProgressAndSuccessCommandKey } from '../utils/notificationMode';

type EditorContext = ActiveEditorContext;

const executeAnonymous = Effect.fn('ApexLog.ExecuteAnonymous.executeAnonymous')(function* (context: EditorContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.v2.services.ExecuteAnonymousService.use(service => service.clearDiagnostics(context.documentUri));
  const { result, logBody, logId } = yield* api.v2.services.ExecuteAnonymousService.use(service =>
    service.executeAndRetrieveLog(context.text)
  );
  // Compile error: skip log save, fail with a tagged error so the standard command error handler shows the notification
  if (!result.compiled) {
    yield* api.v2.services.ExecuteAnonymousService.use(service =>
      service.reportExecResult(result, context.documentUri, context.selectionRange?.startLine)
    );
    return yield* new ExecAnonCompileError({
      message: nls.localize(
        'exec_anon_compile_error',
        String(result.line ?? 1),
        String(result.column ?? 1),
        result.compileProblem ?? nls.localize('exec_anon_compile_unknown')
      )
    });
  }

  yield* api.v2.services.ExecuteAnonymousService.use(service =>
    service.reportExecResult(result, context.documentUri, context.selectionRange?.startLine, logBody)
  );
  const logUri = yield* saveExecResult(context.text, result, logBody, logId);
  return { result, logUri };
});

export const executeAnonymousCommand = Effect.fn('ApexLog.Command.executeAnonymous')(function* (
  selectionOnly: boolean
) {
  yield* Effect.annotateCurrentSpan({ selectionOnly });
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.v2.services.PromptService;
  const notificationMode = yield* api.v2.services.NotificationModeService;
  const command: ProgressAndSuccessCommandKey = selectionOnly
    ? "SFDX: Execute Anonymous Apex with Editor's Selected Text"
    : 'SFDX: Execute Anonymous Apex with Currently Open Editor';
  const progressLocation = yield* notificationMode.getProgressLocation(command);
  // progress dismisses once execution+save resolve; the success toast (with its open-log action) follows
  yield* api.v2.services.EditorService.use(service => service.getActiveEditorContext(selectionOnly)).pipe(
    Effect.flatMap(executeAnonymous),
    promptService.withProgress(nls.localize('exec_anon_progress_title'), progressLocation),
    Effect.tap(({ result, logUri }) => {
      const openLogAction = {
        label: nls.localize('open_log'),
        run: () =>
          getRuntime()
            .runPromise(api.v2.services.FsService.use(service => service.showTextDocument(logUri)))
            .then(() => undefined)
      };
      return result.success
        ? notificationMode.showSuccessNotification(command, nls.localize('exec_anon_success'), false, [openLogAction])
        : notificationMode.showErrorWithActions(result.exceptionMessage ?? nls.localize('exec_anon_runtime_unknown'), [
            openLogAction
          ]);
    }),
    Effect.map(({ logUri }) => logUri)
  );
});
