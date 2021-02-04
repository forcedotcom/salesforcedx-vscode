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
  CommandletExecutor,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import { useApexLibrary } from '../settings';

type TempFile = { fileName: string };

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
  constructor() {
    super(OUTPUT_CHANNEL);
  }

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
    // @ts-ignore
    const executeService = new ExecuteService(connection);
    const { apexCode, fileName: apexFilePath } = response.data;

    const result = await executeService.executeAnonymous({
      apexFilePath,
      apexCode
    });

    this.outputResult(result);

    const editor = vscode.window.activeTextEditor;
    const document = editor!.document;
    const filePath = apexFilePath ?? document.uri.fsPath;

    this.handleDiagnostics(result, filePath);

    return result.success;
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

  private handleDiagnostics(
    response: ExecuteAnonymousResponse,
    filePath: string
  ) {
    ApexLibraryExecuteExecutor.diagnostics.clear();

    if (response.diagnostic) {
      const {
        compileProblem,
        exceptionMessage,
        lineNumber,
        columnNumber
      } = response.diagnostic[0];
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
        range: this.getZeroBasedRange(
          Number(lineNumber) || 1,
          Number(columnNumber) || 1
        )
      };

      ApexLibraryExecuteExecutor.diagnostics.set(vscode.Uri.file(filePath), [
        vscDiagnostic
      ]);
    }
  }

  private getZeroBasedRange(line: number, column: number): vscode.Range {
    const pos = new vscode.Position(
      line > 0 ? line - 1 : 0,
      column > 0 ? column - 1 : 0
    );
    return new vscode.Range(pos, pos);
  }
}

export async function forceApexExecute() {
  let parametersGatherer: ParametersGatherer<any>;
  let executor: CommandletExecutor<any>;

  if (useApexLibrary()) {
    parametersGatherer = new AnonApexGatherer();
    executor = new ApexLibraryExecuteExecutor();
  } else {
    parametersGatherer = new CreateApexTempFile();
    executor = new ForceApexExecuteExecutor();
  }

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    parametersGatherer,
    executor
  );

  await commandlet.run();
}
