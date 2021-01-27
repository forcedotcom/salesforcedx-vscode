/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ExecuteAnonymousResponse,
  ExecuteService
} from '@salesforce/apex-node';
import {
  getRootWorkspacePath,
  hasRootWorkspace,
  LibraryCommandletExecutor,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../constants';
import { workspaceContext } from '../context';
import { nls } from '../messages';

type TempFile = { fileName: string };

function getApexLibrarySetting(): boolean {
  const config = vscode.workspace.getConfiguration('salesforcedx-vscode-core');
  return config.get<boolean>('experimental.useApexLibrary', true);
}

function getRange(lineNumber: string, columnNumber: string): vscode.Range {
  const ln = Number(lineNumber);
  const col = Number(columnNumber);
  const pos = new vscode.Position(ln > 0 ? ln - 1 : 0, col > 0 ? col - 1 : 0);
  return new vscode.Range(pos, pos);
}

export class CreateApexTempFile implements ParametersGatherer<TempFile> {
  public async gather(): Promise<CancelResponse | ContinueResponse<TempFile>> {
    if (hasRootWorkspace()) {
      const fileName = path.join(
        getRootWorkspacePath(),
        '.sfdx',
        'tools',
        'tempApex.input'
      );
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        return { type: 'CANCEL' };
      }

      const { document, selection } = editor;
      const contents = document.getText(
        selection.isEmpty ? undefined : selection
      );
      fs.writeFileSync(fileName, contents);

      return { type: 'CONTINUE', data: { fileName } };
    }
    return { type: 'CANCEL' };
  }
}

export class ForceApexExecuteExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: TempFile): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_execute_document_text'))
      .withArg('force:apex:execute')
      .withFlag('--apexcodefile', data.fileName)
      .withLogName('force_apex_execute')
      .build();
  }
}

interface ApexExecuteParameters {
  apexCode?: string;
  fileName?: string;
}

export class AnonApexGatherer
  implements ParametersGatherer<ApexExecuteParameters> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ApexExecuteParameters>
  > {
    if (hasRootWorkspace()) {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return { type: 'CANCEL' };
      }

      const document = editor.document;
      if (!editor.selection.isEmpty || document.isUntitled) {
        return {
          type: 'CONTINUE',
          data: {
            apexCode: !editor.selection.isEmpty
              ? document.getText(editor.selection)
              : document.getText()
          }
        };
      }

      return { type: 'CONTINUE', data: { fileName: document.uri.fsPath } };
    }
    return { type: 'CANCEL' };
  }
}

export class ApexLibraryExecuteExecutor extends LibraryCommandletExecutor<
  ApexExecuteParameters
> {
  public static diagnostics = vscode.languages.createDiagnosticCollection(
    'apex-errors'
  );

  constructor() {
    super(
      nls.localize('apex_execute_text'),
      'force_apex_execute_library',
      OUTPUT_CHANNEL
    );
  }

  public async run(
    response: ContinueResponse<ApexExecuteParameters>
  ): Promise<boolean> {
    const connection = await workspaceContext.getConnection();
    const executeService = new ExecuteService(connection);
    const { apexCode, fileName: apexFilePath } = response.data;

    const result = await executeService.executeAnonymous({
      apexFilePath,
      apexCode
    });

    const { success } = result;
    const formattedResult = this.formatExecuteResult(result);
    OUTPUT_CHANNEL.appendLine(formattedResult);

    const editor = vscode.window.activeTextEditor;
    const document = editor!.document;
    const filePath = apexFilePath ?? document.uri.fsPath;

    this.handleDiagnostics(result, filePath);

    return success;
  }

  private formatExecuteResult(
    execAnonResponse: ExecuteAnonymousResponse
  ): string {
    let outputText = '';
    if (execAnonResponse.success) {
      outputText += `${nls.localize('apex_execute_compile_success')}\n`;
      outputText += `${nls.localize('apex_execute_runtime_success')}\n`;
      outputText += `\n${execAnonResponse.logs}`;
    } else {
      const diagnostic = execAnonResponse.diagnostic![0];

      if (!execAnonResponse.compiled) {
        outputText += `Error: Line: ${diagnostic.lineNumber}, Column: ${diagnostic.columnNumber}\n`;
        outputText += `Error: ${diagnostic.compileProblem}\n`;
      } else {
        outputText += `${nls.localize('apex_execute_compile_success')}\n`;
        outputText += `Error: ${diagnostic.exceptionMessage}\n`;
        outputText += `Error: ${diagnostic.exceptionStackTrace}\n`;
        outputText += `\n${execAnonResponse.logs}`;
      }
    }
    return outputText;
  }

  private handleDiagnostics(
    apexResult: ExecuteAnonymousResponse,
    filePath: string
  ) {
    ApexLibraryExecuteExecutor.diagnostics.clear();

    if (apexResult.diagnostic) {
      const range = getRange(
        apexResult.diagnostic[0].lineNumber
          ? apexResult.diagnostic[0].lineNumber.toString()
          : '1',
        apexResult.diagnostic[0].columnNumber
          ? apexResult.diagnostic[0].columnNumber.toString()
          : '1'
      );

      const diagnostic = {
        message:
          typeof apexResult.diagnostic[0].compileProblem === 'string'
            ? apexResult.diagnostic[0].compileProblem
            : apexResult.diagnostic[0].exceptionMessage,
        severity: vscode.DiagnosticSeverity.Error,
        source: filePath,
        range
      } as vscode.Diagnostic;

      ApexLibraryExecuteExecutor.diagnostics.set(vscode.Uri.file(filePath), [
        diagnostic
      ]);
    }
  }
}

export async function forceApexExecute() {
  const useApexLibrary = getApexLibrarySetting();
  const parameterGatherer = useApexLibrary
    ? new AnonApexGatherer()
    : new CreateApexTempFile();
  const executeExecutor = useApexLibrary
    ? new ApexLibraryExecuteExecutor()
    : new ForceApexExecuteExecutor();

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    parameterGatherer,
    executeExecutor
  );
  await commandlet.run();
}
