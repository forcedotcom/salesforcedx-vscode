/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService, getProgressLocation, showSuccessNotification } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { format } from 'node:util';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { getRuntime } from '../services/runtime';
import { type ProgressAndSuccessCommandKey } from '../utils/notificationMode';

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
  logs?: string
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  if (!logs) return false;
  yield* api.services.FsService.safeWriteFile(logFilePath, logs);
  yield* Effect.promise(() =>
    vscode.commands.executeCommand('sf.launch.replay.debugger.logfile.path', logFilePath.fsPath)
  );
  return true;
});

type AnonApexContext =
  | { kind: 'code'; apexCode: string; selectionRange?: vscode.Range; documentUri: URI }
  | { kind: 'file'; filePath: string; documentUri: URI };

const getAnonApexContext = Effect.fn('ApexReplayDebugger.getAnonApexContext')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { isEmpty } = yield* api.services.WorkspaceService.getWorkspaceInfo();
  if (isEmpty) return undefined;
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;
  const document = editor.document;
  if (!editor.selection.isEmpty || document.isUntitled || document.isDirty) {
    return {
      kind: 'code',
      apexCode: !editor.selection.isEmpty ? document.getText(editor.selection) : document.getText(),
      selectionRange: !editor.selection.isEmpty
        ? new vscode.Range(editor.selection.start, editor.selection.end)
        : undefined,
      documentUri: URI.parse(document.uri.toString())
    } satisfies AnonApexContext;
  }
  return {
    kind: 'file',
    filePath: document.uri.fsPath,
    documentUri: URI.file(document.uri.fsPath)
  } satisfies AnonApexContext;
});

const executeAnonApexDebug = Effect.fn('ApexReplayDebugger.executeAnonApexDebug')(function* () {
  const ctx = yield* getAnonApexContext();
  if (!ctx) return false;

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const code = ctx.kind === 'code' ? ctx.apexCode : yield* api.services.FsService.readFile(ctx.filePath);
  if (!code) return false;

  const { result, logBody } = yield* api.services.ExecuteAnonymousService.executeAndRetrieveLog(code);
  yield* api.services.ExecuteAnonymousService.reportExecResult(
    result,
    ctx.documentUri,
    ctx.kind === 'code' ? ctx.selectionRange?.start.line : undefined
  );

  if (!result.compiled || !result.success) return false;

  const logFilePath = Utils.joinPath(
    yield* api.services.ProjectService.getDebugLogsFolder(),
    `${getYYYYMMddHHmmssDateFormat(new Date())}.log`
  );
  return yield* launchReplayDebugger(logFilePath, logBody ?? undefined);
});

const COMMAND: ProgressAndSuccessCommandKey = 'Debug Anonymous Apex';

export const anonApexDebug = async (): Promise<void> => {
  const success = await vscode.window.withProgress(
    {
      location: getRuntime().runSync(getProgressLocation(COMMAND)),
      title: nls.localize('apex_execute_text'),
      cancellable: false
    },
    () =>
      getRuntime()
        .runPromise(executeAnonApexDebug())
        .catch((error: unknown) => {
          void vscode.window.showErrorMessage(nls.localize('apex_execute_debug_failed', String(error)));
        })
  );
  if (success) {
    void getRuntime().runPromise(showSuccessNotification(COMMAND, nls.localize('apex_execute_debug_success'), false));
  }
};
