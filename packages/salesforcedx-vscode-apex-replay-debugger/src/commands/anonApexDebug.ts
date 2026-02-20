/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ApexDiagnostic } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import {
  CancelResponse,
  ContinueResponse,
  LibraryCommandletExecutor,
  ParametersGatherer,
  SfCommandlet,
  SfWorkspaceChecker,
  getYYYYMMddHHmmssDateFormat,
  hasRootWorkspace,
  projectPaths,
  createDirectory,
  readFile,
  writeFile
} from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { OUTPUT_CHANNEL, channelService } from '../channels';
import { nls } from '../messages';
import { AllServicesLayer } from '../services/extensionProvider';
import { getZeroBasedRange } from './range';

type ExecResultAdapted = {
  compiled: boolean;
  success: boolean;
  logs?: string;
  diagnostic?: ApexDiagnostic[];
};

type ApexExecuteParameters = {
  apexCode?: string;
  fileName?: string;
  selection?: vscode.Range;
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

const outputResult = (response: ExecResultAdapted): void => {
  const outputText = response.success
    ? `${nls.localize('apex_execute_compile_success')}\n${nls.localize('apex_execute_runtime_success')}\n\n${response.logs}`
    : (() => {
        const diagnostic = response.diagnostic![0];
        return !response.compiled
          ? `Error: Line: ${diagnostic.lineNumber}, Column: ${diagnostic.columnNumber}\nError: ${diagnostic.compileProblem}\n`
          : `${nls.localize('apex_execute_compile_success')}\nError: ${diagnostic.exceptionMessage}\nError: ${diagnostic.exceptionStackTrace}\n\n${response.logs}`;
      })();
  channelService.appendLine(outputText);
};

const handleDiagnostics = (
  response: ExecResultAdapted,
  filePath: string,
  selection: vscode.Range | undefined,
  diagnostics: vscode.DiagnosticCollection
): void => {
  diagnostics.clear();
  if (response.diagnostic) {
    const { compileProblem, exceptionMessage, lineNumber, columnNumber } = response.diagnostic[0];
    const message =
      compileProblem && compileProblem !== ''
        ? compileProblem
        : exceptionMessage && exceptionMessage !== ''
          ? exceptionMessage
          : nls.localize('apex_execute_unexpected_error');
    diagnostics.set(URI.file(filePath), [
      {
        message,
        severity: vscode.DiagnosticSeverity.Error,
        source: filePath,
        range: getZeroBasedRange(lineNumber ? lineNumber + (selection?.start.line ?? 0) : 1, columnNumber ?? 1)
      }
    ]);
  }
};

const processResult = (
  result: ExecResultAdapted,
  apexFilePath: string | undefined,
  selection: vscode.Range | undefined,
  diagnostics: vscode.DiagnosticCollection
): void => {
  outputResult(result);
  const editor = vscode.window.activeTextEditor;
  const document = editor!.document;
  const filePath = apexFilePath ?? document.uri.fsPath;
  handleDiagnostics(result, filePath, selection, diagnostics);
};

const launchReplayDebugger = async (logs?: string): Promise<boolean> => {
  const logFilePath = getLogFilePath();
  if (!logFilePath || !logs || !(await saveLogFile(logFilePath, logs))) return false;
  await vscode.commands.executeCommand('sf.launch.replay.debugger.logfile.path', logFilePath);
  return true;
};

class AnonApexGatherer implements ParametersGatherer<ApexExecuteParameters> {
  public gather(): Promise<CancelResponse | ContinueResponse<ApexExecuteParameters>> {
    if (hasRootWorkspace()) {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return Promise.resolve({ type: 'CANCEL' });
      }

      const document = editor.document;
      if (!editor.selection.isEmpty || document.isUntitled || document.isDirty) {
        return Promise.resolve({
          type: 'CONTINUE',
          data: {
            apexCode: !editor.selection.isEmpty ? document.getText(editor.selection) : document.getText(),
            selection: !editor.selection.isEmpty
              ? new vscode.Range(editor.selection.start, editor.selection.end)
              : undefined
          }
        });
      }

      return Promise.resolve({
        type: 'CONTINUE',
        data: { fileName: document.uri.fsPath }
      });
    }
    return Promise.resolve({ type: 'CANCEL' });
  }
}

class AnonApexLibraryDebugExecutor extends LibraryCommandletExecutor<ApexExecuteParameters> {
  public static diagnostics = vscode.languages.createDiagnosticCollection('apex-errors');

  constructor() {
    super(nls.localize('apex_execute_text'), 'apex_execute_library', OUTPUT_CHANNEL);
  }

  public async run(response: ContinueResponse<ApexExecuteParameters>): Promise<boolean> {
    const { apexCode, fileName: apexFilePath, selection } = response.data;
    const code = apexCode ?? (apexFilePath ? await readFile(apexFilePath) : undefined);
    if (!code) {
      return false;
    }

    let execResult;
    try {
      execResult = await Effect.runPromise(
        Effect.gen(function* () {
          const api = yield* (yield* ExtensionProviderService).getServicesApi;
          const execService = yield* api.services.ExecuteAnonymousService;
          return yield* execService.executeAndRetrieveLog(code);
        }).pipe(Effect.provide(AllServicesLayer))
      );
    } catch (error) {
      void vscode.window.showErrorMessage(nls.localize('apex_execute_debug_failed', String(error)));
      return false;
    }

    if (!execResult?.result) {
      return false;
    }

    const { result, logBody } = execResult;
    const adapted: ExecResultAdapted = {
      compiled: result.compiled,
      success: result.success,
      logs: logBody || undefined,
      diagnostic: !result.success
        ? [
            {
              lineNumber: result.line,
              columnNumber: result.column,
              compileProblem: result.compileProblem ?? '',
              exceptionMessage: result.exceptionMessage ?? '',
              exceptionStackTrace: result.exceptionStackTrace ?? ''
            }
          ]
        : undefined
    };

    processResult(adapted, apexFilePath, selection, AnonApexLibraryDebugExecutor.diagnostics);
    return await launchReplayDebugger(adapted.logs);
  }
}

export const anonApexDebug = async () => {
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new AnonApexGatherer(),
    new AnonApexLibraryDebugExecutor()
  );
  await commandlet.run();
};
