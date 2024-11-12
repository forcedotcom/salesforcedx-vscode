/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExecuteAnonymousResponse, ExecuteService } from '@salesforce/apex-node-bundle';
import { Connection } from '@salesforce/core-bundle';
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
  projectPaths
} from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL, channelService } from '../channels';
import { workspaceContext } from '../context';
import { nls } from '../messages';

type ApexExecuteParameters = {
  apexCode?: string;
  fileName?: string;
  selection?: vscode.Range;
};

export class AnonApexGatherer implements ParametersGatherer<ApexExecuteParameters> {
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

export class AnonApexLibraryExecuteExecutor extends LibraryCommandletExecutor<ApexExecuteParameters> {
  public static diagnostics = vscode.languages.createDiagnosticCollection('apex-errors');

  private isDebugging: boolean;

  constructor(isDebugging: boolean) {
    super(nls.localize('apex_execute_text'), 'apex_execute_library', OUTPUT_CHANNEL);

    this.isDebugging = isDebugging;
  }

  public async run(response: ContinueResponse<ApexExecuteParameters>): Promise<boolean> {
    const connection = await workspaceContext.getConnection();
    if (this.isDebugging) {
      if (!(await this.setUpTraceFlags(connection))) {
        return false;
      }
    }

    const executeService = new ExecuteService(connection);
    const { apexCode, fileName: apexFilePath, selection } = response.data;

    const result = await executeService.executeAnonymous({
      apexFilePath,
      apexCode
    });

    this.processResult(result, apexFilePath, selection);

    if (this.isDebugging) {
      return await this.launchReplayDebugger(result.logs);
    }

    return true;
  }

  private async setUpTraceFlags(connection: Connection): Promise<boolean> {
    const traceFlags = new TraceFlags(connection);
    if (!(await traceFlags.ensureTraceFlags())) {
      return false;
    }

    return true;
  }

  private processResult(result: ExecuteAnonymousResponse, apexFilePath: string | undefined, selection: any) {
    this.outputResult(result);

    const editor = vscode.window.activeTextEditor;
    const document = editor!.document;
    const filePath = apexFilePath ?? document.uri.fsPath;
    this.handleDiagnostics(result, filePath, selection);
  }

  private async launchReplayDebugger(logs?: string | undefined): Promise<boolean> {
    const logFilePath = this.getLogFilePath();
    if (!this.saveLogFile(logFilePath, logs)) {
      return false;
    }

    await vscode.commands.executeCommand('sf.launch.replay.debugger.logfile.path', logFilePath);

    return true;
  }

  private getLogFilePath(): string {
    const outputDir = projectPaths.debugLogsFolder();
    const now = new Date();
    const localDateFormatted = getYYYYMMddHHmmssDateFormat(now);
    const logFilePath = path.join(outputDir, `${localDateFormatted}.log`);

    return logFilePath;
  }

  private saveLogFile(logFilePath: string, logs?: string): boolean {
    if (!logFilePath || !logs) {
      return false;
    }

    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    fs.writeFileSync(logFilePath, logs);

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

      if (!response.compiled) {
        outputText += `Error: Line: ${diagnostic.lineNumber}, Column: ${diagnostic.columnNumber}\n`;
        outputText += `Error: ${diagnostic.compileProblem}\n`;
      } else {
        outputText += `${nls.localize('apex_execute_compile_success')}\n`;
        outputText += `Error: ${diagnostic.exceptionMessage}\n`;
        outputText += `Error: ${diagnostic.exceptionStackTrace}\n`;
        outputText += `\n${response.logs}`;
      }
    }
    channelService.appendLine(outputText);
  }

  private handleDiagnostics(response: ExecuteAnonymousResponse, filePath: string, selection?: vscode.Range) {
    AnonApexLibraryExecuteExecutor.diagnostics.clear();

    if (response.diagnostic) {
      const { compileProblem, exceptionMessage, lineNumber, columnNumber } = response.diagnostic[0];
      let message;
      if (compileProblem && compileProblem !== '') {
        message = compileProblem;
      } else if (exceptionMessage && exceptionMessage !== '') {
        message = exceptionMessage;
      } else {
        message = nls.localize('apex_execute_unexpected_error');
      }
      const vscDiagnostic: vscode.Diagnostic = {
        message,
        severity: vscode.DiagnosticSeverity.Error,
        source: filePath,
        range: this.adjustErrorRange(Number(lineNumber), Number(columnNumber), selection)
      };

      AnonApexLibraryExecuteExecutor.diagnostics.set(vscode.Uri.file(filePath), [vscDiagnostic]);
    }
  }

  private adjustErrorRange(
    lineNumber: number | undefined,
    columnNumber: number | undefined,
    selection?: vscode.Range
  ): vscode.Range {
    const lineOffset = selection ? selection.start.line : 0;
    const adjustedLine = lineNumber ? lineNumber + lineOffset : 1;
    return this.getZeroBasedRange(adjustedLine, columnNumber || 1);
  }

  private getZeroBasedRange(line: number, column: number): vscode.Range {
    const pos = new vscode.Position(line > 0 ? line - 1 : 0, column > 0 ? column - 1 : 0);
    return new vscode.Range(pos, pos);
  }
}

export const anonApexExecute = async () => {
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new AnonApexGatherer(),
    new AnonApexLibraryExecuteExecutor(false)
  );

  await commandlet.run();
};

export const anonApexDebug = async () => {
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new AnonApexGatherer(),
    new AnonApexLibraryExecuteExecutor(true)
  );

  await commandlet.run();
};
