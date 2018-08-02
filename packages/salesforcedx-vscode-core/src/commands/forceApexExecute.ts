/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
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
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

class ForceApexExecuteExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: TempFile): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_execute_document_text'))
      .withArg('force:apex:execute')
      .withFlag('--apexcodefile', data.fileName)
      .build();
  }

  public execute(response: ContinueResponse<TempFile>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(async data => {
      fs.unlink(response.data.fileName, err => null);
    });

    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.stderrSubject as any) as Observable<Error | undefined>
    );
    channelService.showChannelOutput();
    channelService.streamCommandOutput(execution);
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

class CreateApexTempFile implements ParametersGatherer<{ fileName: string }> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ fileName: string }>
  > {
    if (vscode.workspace.rootPath) {
      const fileName = path.join(
        vscode.workspace.rootPath,
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

const workspaceChecker = new SfdxWorkspaceChecker();
const fileNameGatherer = new CreateApexTempFile();

export async function forceApexExecute(withSelection?: any) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    fileNameGatherer,
    new ForceApexExecuteExecutor()
  );
  await commandlet.run();
}
