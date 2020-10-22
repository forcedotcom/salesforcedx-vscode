/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExecuteService } from '@salesforce/apex-node';
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
import { channelService } from '../channels';
import { workspaceContext } from '../context';
import { handleApexLibraryDiagnostics } from '../diagnostics';
import { nls } from '../messages';
import { sfdxCoreSettings } from '../settings';
import { getRootWorkspacePath, hasRootWorkspace } from '../util';
import {
  CommandletExecutor,
  LibraryCommandletExecutor,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';
import { formatExecuteResult } from './util/apexLibraryResultFormatter';

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

export class CreateApexTempFile
  implements ParametersGatherer<{ fileName: string }> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ fileName: string }>
  > {
    if (hasRootWorkspace()) {
      const fileName = path.join(
        getRootWorkspacePath(),
        '.sfdx',
        'tools',
        'tempApex.input'
      );
      const editor = await vscode.window.activeTextEditor;

      if (!editor) {
        return { type: 'CANCEL' };
      }

      let writeFile;
      const document = editor.document;

      if (editor.selection.isEmpty) {
        writeFile = await writeFileAsync(fileName, document.getText());
      } else {
        writeFile = await writeFileAsync(
          fileName,
          document.getText(editor.selection)
        );
      }

      return writeFile
        ? { type: 'CONTINUE', data: { fileName } }
        : { type: 'CANCEL' };
    }
    return { type: 'CANCEL' };
  }
}

type TempFile = {
  fileName: string;
};

export function writeFileAsync(fileName: string, inputText: string) {
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, inputText, err => {
      if (err) {
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
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

export class ApexLibraryExecuteExecutor extends LibraryCommandletExecutor<ApexExecuteParameters> {
  protected executionName = nls.localize('apex_execute_text');
  protected logName = 'force_apex_execute_library';

  private diagnostics = vscode.languages.createDiagnosticCollection(
    'apex-errors'
  );

  protected async run(response: ContinueResponse<ApexExecuteParameters>): Promise<boolean> {
    const connection = await workspaceContext.getConnection();
    // @ts-ignore
    const executeService = new ExecuteService(connection);
    const { apexCode, fileName: apexFilePath } = response.data;

    const result = await executeService.executeAnonymous({
      apexFilePath,
      apexCode
    });

    const { success } = result;
    const formattedResult = formatExecuteResult(result);
    channelService.appendLine(formattedResult);

    if (success) {
      this.diagnostics.clear();
    } else {
      const editor = vscode.window.activeTextEditor;
      const document = editor!.document;
      const filePath = apexFilePath || document.uri.fsPath;

      handleApexLibraryDiagnostics(result, this.diagnostics, filePath);
    }

    return success;
  }
}

export async function forceApexExecute() {
  const parameterGatherer = sfdxCoreSettings.getApexLibrary()
    ? new AnonApexGatherer()
    : new CreateApexTempFile();
  const executeExecutor = sfdxCoreSettings.getApexLibrary()
    ? new ApexLibraryExecuteExecutor()
    : new ForceApexExecuteExecutor();

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    parameterGatherer as ParametersGatherer<{}>,
    executeExecutor as CommandletExecutor<{}>
  );
  await commandlet.run();
}
