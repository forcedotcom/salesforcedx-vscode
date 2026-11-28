/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import { format } from 'node:util';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { type ProgressAndSuccessCommandKey } from '../utils/notificationMode';
import { launchFromLogFile } from './launchFromLogFile';

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
  logs?: string,
  anonApexFilePath?: string,
  anonApexLineOffset?: number
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  if (!logs) return false;
  yield* api.v2.services.FsService.use(service => service.safeWriteFile(logFilePath, logs));
  yield* launchFromLogFile(logFilePath.fsPath, true, anonApexFilePath, anonApexLineOffset);
  return true;
});

type AnonApexContext =
  | { kind: 'code'; apexCode: string; selectionRange?: vscode.Range; documentUri: URI }
  | { kind: 'file'; filePath: string; documentUri: URI };

const getAnonApexContext = Effect.fn('ApexReplayDebugger.getAnonApexContext')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { isEmpty } = yield* api.v2.services.WorkspaceService.use(service => service.getWorkspaceInfo());
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
      documentUri: document.uri
    } satisfies AnonApexContext;
  }
  return {
    kind: 'file',
    filePath: document.uri.fsPath,
    documentUri: document.uri
  } satisfies AnonApexContext;
});

const executeAnonApexDebug = Effect.fn('ApexReplayDebugger.executeAnonApexDebug')(function* () {
  const ctx = yield* getAnonApexContext();
  if (!ctx) return false;

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const notificationMode = yield* api.v2.services.NotificationModeService;
  const code =
    ctx.kind === 'code'
      ? ctx.apexCode
      : yield* api.v2.services.FsService.use(service => service.readFile(ctx.filePath));
  if (!code) return false;

  const { result, logBody } = yield* api.v2.services.ExecuteAnonymousService.use(service =>
    service.executeAndRetrieveLog(code)
  );
  yield* api.v2.services.ExecuteAnonymousService.use(service =>
    service.reportExecResult(result, ctx.documentUri, ctx.kind === 'code' ? ctx.selectionRange?.start.line : undefined)
  );

  if (!result.compiled || !result.success) return false;

  const now = yield* DateTime.nowAsDate;
  const logFilePath = Utils.joinPath(
    yield* api.v2.services.ProjectService.use(service => service.getDebugLogsFolder()),
    `${getYYYYMMddHHmmssDateFormat(now)}.log`
  );
  const success = yield* launchReplayDebugger(
    logFilePath,
    logBody ?? undefined,
    ctx.kind === 'code' ? ctx.documentUri.fsPath : ctx.filePath,
    ctx.kind === 'code' ? (ctx.selectionRange?.start.line ?? 0) : 0
  );
  if (success) {
    yield* notificationMode.showSuccessNotification(COMMAND, nls.localize('apex_execute_debug_success'), false);
  }
  return success;
});

const COMMAND: ProgressAndSuccessCommandKey = 'Debug Anonymous Apex';

export const anonApexDebugCommand = Effect.fn('ApexReplayDebugger.anonApexDebugCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const notificationMode = yield* api.v2.services.NotificationModeService;
  const progressLocation = yield* notificationMode.getProgressLocation(COMMAND);
  const prompts = yield* api.v2.services.PromptService;
  yield* executeAnonApexDebug().pipe(
    prompts.withProgress(nls.localize('apex_execute_text'), progressLocation),
    Effect.catch(error =>
      Effect.sync(() => {
        void vscode.window.showErrorMessage(nls.localize('apex_execute_debug_failed', String(error)));
      })
    )
  );
});
