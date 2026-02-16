/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExecuteAnonymousResponse, ExecuteService } from '@salesforce/apex-node';
import type { Connection } from '@salesforce/core';
import {
  CancelResponse,
  ContinueResponse,
  LibraryCommandletExecutor,
  ParametersGatherer,
  SfCommandlet,
  SfWorkspaceChecker,
  TraceFlags,
  getYYYYMMddHHmmssDateFormat,
  hasRootWorkspace,
  projectPaths,
  createDirectory,
  writeFile
} from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { OUTPUT_CHANNEL, channelService } from '../channels';
import { getVscodeCoreExtension } from '../coreExtensionUtils';
import { nls } from '../messages';
import { getZeroBasedRange } from './range';

type ApexExecuteParameters = {
  apexCode?: string;
  fileName?: string;
  selection?: vscode.Range;
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
    const vscodeCoreExtension = await getVscodeCoreExtension();
    const connection = await vscodeCoreExtension.exports.WorkspaceContext.getInstance().getConnection();
    if (!(await this.setUpTraceFlags(connection))) {
      return false;
    }

    const executeService = new ExecuteService(connection);
    const { apexCode, fileName: apexFilePath, selection } = response.data;

    const result = await executeService.executeAnonymous({
      apexFilePath,
      apexCode
    });

    this.processResult(result, apexFilePath, selection);
    return await this.launchReplayDebugger(result.logs);
  }

  private async setUpTraceFlags(connection: Connection): Promise<boolean> {
    const traceFlags = new TraceFlags(connection);
    return traceFlags.ensureTraceFlags();
  }

  private processResult(
    result: ExecuteAnonymousResponse,
    apexFilePath: string | undefined,
    selection: vscode.Range | undefined
  ) {
    this.outputResult(result);

    const editor = vscode.window.activeTextEditor;
    const document = editor!.document;
    const filePath = apexFilePath ?? document.uri.fsPath;
    this.handleDiagnostics(result, filePath, selection);
  }

  private async launchReplayDebugger(logs?: string | undefined): Promise<boolean> {
    const logFilePath = this.getLogFilePath();
    if (!logFilePath || !logs || !(await this.saveLogFile(logFilePath, logs))) {
      return false;
    }
    await vscode.commands.executeCommand('sf.launch.replay.debugger.logfile.path', logFilePath);
    return true;
  }

  private getLogFilePath(): string {
    const outputDir = projectPaths.debugLogsFolder();
    const now = new Date();
    const localDateFormatted = getYYYYMMddHHmmssDateFormat(now);
    return path.join(outputDir, `${localDateFormatted}.log`);
  }

  private async saveLogFile(logFilePath: string, logs?: string): Promise<boolean> {
    if (!logFilePath || !logs) return false;
    await createDirectory(path.dirname(logFilePath));
    await writeFile(logFilePath, logs);
    return true;
  }

  private outputResult(response: ExecuteAnonymousResponse): void {
    let outputText = '';
    if (response.success) {
      outputText += `${nls.localize('apex_execute_compile_success')}\n`;
      outputText += `${nls.localize('apex_execute_runtime_success')}\n`;
      outputText += `\n${response.logs}`;
    } else {
      const diagnostic = response.diagnostic![0];
      outputText += !response.compiled
        ? `Error: Line: ${diagnostic.lineNumber}, Column: ${diagnostic.columnNumber}\nError: ${diagnostic.compileProblem}\n`
        : `${nls.localize('apex_execute_compile_success')}\nError: ${diagnostic.exceptionMessage}\nError: ${diagnostic.exceptionStackTrace}\n\n${response.logs}`;
    }
    channelService.appendLine(outputText);
  }

  private handleDiagnostics(response: ExecuteAnonymousResponse, filePath: string, selection?: vscode.Range) {
    AnonApexLibraryDebugExecutor.diagnostics.clear();
    if (response.diagnostic) {
      const { compileProblem, exceptionMessage, lineNumber, columnNumber } = response.diagnostic[0];
      const message =
        compileProblem && compileProblem !== ''
          ? compileProblem
          : exceptionMessage && exceptionMessage !== ''
            ? exceptionMessage
            : nls.localize('apex_execute_unexpected_error');
      AnonApexLibraryDebugExecutor.diagnostics.set(URI.file(filePath), [
        {
          message,
          severity: vscode.DiagnosticSeverity.Error,
          source: filePath,
          range: getZeroBasedRange(lineNumber ? lineNumber + (selection?.start.line ?? 0) : 1, columnNumber ?? 1)
        }
      ]);
    }
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
