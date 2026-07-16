/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { projectPaths, createDirectory, readFile, writeFile } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as path from 'node:path';
import { format } from 'node:util';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../messages';
import { getRuntime } from '../services/runtime';

export const makeDoubleDigit = (currentDigit: number): string => format('%d', currentDigit).padStart(2, '0');

export const getYYYYMMddHHmmssDateFormat = (localUTCDate: Date): string => {
  const month2Digit = makeDoubleDigit(localUTCDate.getMonth() + 1);
  const date2Digit = makeDoubleDigit(localUTCDate.getDate());
  const hour2Digit = makeDoubleDigit(localUTCDate.getHours());
  const mins2Digit = makeDoubleDigit(localUTCDate.getMinutes());
  const sec2Digit = makeDoubleDigit(localUTCDate.getSeconds());

  return `${localUTCDate.getFullYear()}${month2Digit}${date2Digit}${hour2Digit}${mins2Digit}${sec2Digit}`;
};

const getLogFilePath = (): string => {
  const outputDir = projectPaths.debugLogsFolder();
  const now = new Date();
  const localDateFormatted = getYYYYMMddHHmmssDateFormat(now);
  return path.join(outputDir, `${localDateFormatted}.log`);
};

const saveLogFile = async (logFilePath: string, logs?: string): Promise<boolean> => {
  if (!logFilePath || !logs) return false;
  await createDirectory(path.dirname(logFilePath));
  await writeFile(logFilePath, logs);
  return true;
};

const launchReplayDebugger = async (logs?: string): Promise<boolean> => {
  const logFilePath = getLogFilePath();
  if (!logFilePath || !logs || !(await saveLogFile(logFilePath, logs))) return false;
  await vscode.commands.executeCommand('sf.launch.replay.debugger.logfile.path', logFilePath);
  return true;
};

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
  return { kind: 'file', filePath: document.uri.fsPath, documentUri: URI.file(document.uri.fsPath) } satisfies AnonApexContext;
});

const executeAnonApexDebug = Effect.fn('ApexReplayDebugger.executeAnonApexDebug')(function* () {
  const ctx = yield* getAnonApexContext();
  if (!ctx) return false;

  const code = ctx.kind === 'code' ? ctx.apexCode : yield* Effect.promise(() => readFile(ctx.filePath));
  if (!code) return false;

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { result, logBody } = yield* api.services.ExecuteAnonymousService.executeAndRetrieveLog(code);
  yield* api.services.ExecuteAnonymousService.reportExecResult(
    result,
    ctx.documentUri,
    ctx.kind === 'code' ? ctx.selectionRange?.start.line : undefined
  );

  if (!result.compiled || !result.success) return false;

  return yield* Effect.promise(() => launchReplayDebugger(logBody ?? undefined));
});

export const anonApexDebug = async (): Promise<void> => {
  const success = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: nls.localize('apex_execute_text'), cancellable: false },
    () =>
      getRuntime()
        .runPromise(executeAnonApexDebug())
        .catch((error: unknown) => {
          void vscode.window.showErrorMessage(nls.localize('apex_execute_debug_failed', String(error)));
        })
  );
  if (success) {
    void vscode.window.showInformationMessage(nls.localize('apex_execute_debug_success'));
  }
};
