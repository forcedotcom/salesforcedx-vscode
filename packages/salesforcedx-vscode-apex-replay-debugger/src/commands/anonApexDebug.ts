/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { format } from 'node:util';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';

export const makeDoubleDigit = (currentDigit: number): string => format('%d', currentDigit).padStart(2, '0');

export const getYYYYMMddHHmmssDateFormat = (localUTCDate: Date): string => {
  const month2Digit = makeDoubleDigit(localUTCDate.getMonth() + 1);
  const date2Digit = makeDoubleDigit(localUTCDate.getDate());
  const hour2Digit = makeDoubleDigit(localUTCDate.getHours());
  const mins2Digit = makeDoubleDigit(localUTCDate.getMinutes());
  const sec2Digit = makeDoubleDigit(localUTCDate.getSeconds());

  return `${localUTCDate.getFullYear()}${month2Digit}${date2Digit}${hour2Digit}${mins2Digit}${sec2Digit}`;
};

/** safeWriteFile creates the parent directory, so no separate createDirectory call is needed. */
const launchReplayDebugger = Effect.fn('ApexReplayDebugger.launchReplayDebugger')(function* (
  logFilePath: URI,
  logs: string
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.FsService.safeWriteFile(logFilePath, logs);
  yield* Effect.promise(() =>
    vscode.commands.executeCommand('sf.launch.replay.debugger.logfile.path', logFilePath.fsPath)
  );
});

export const anonApexDebugCommand = Effect.fn('ApexReplayDebugger.Command.anonApexDebug')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const context = yield* api.services.EditorService.getActiveEditorContext(true);
  const executionResult = yield* Effect.gen(function* () {
    const { result, logBody } = yield* api.services.ExecuteAnonymousService.executeAndRetrieveLog(context.text);
    yield* api.services.ExecuteAnonymousService.reportExecResult(
      result,
      context.documentUri,
      context.selectionRange?.startLine
    );

    if (result.compiled && result.success) {
      const logFilePath = Utils.joinPath(
        yield* api.services.ProjectService.getDebugLogsFolder(),
        `${getYYYYMMddHHmmssDateFormat(new Date())}.log`
      );
      yield* launchReplayDebugger(logFilePath, logBody);
    }
    return result;
  }).pipe(promptService.withProgress(nls.localize('apex_execute_text')));

  yield* Effect.sync(() => {
    if (executionResult.compiled && executionResult.success) {
      void vscode.window.showInformationMessage(nls.localize('apex_execute_debug_success'));
    }
  });
});
