/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExecuteService } from '@salesforce/apex-node';
import { Connection } from '@salesforce/core';
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
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { sfdxCoreSettings } from '../settings';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, hasRootWorkspace } from '../util';
import {
  ApexLibraryExecutor,
  CommandletExecutor,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

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

export class AnonApexGatherer
  implements ParametersGatherer<{ fileName?: string; apexCode?: string }> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ fileName?: string; apexCode?: string }>
  > {
    if (hasRootWorkspace()) {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return { type: 'CANCEL' };
      }

      const document = editor.document;
      if (!editor.selection.isEmpty || !fs.existsSync(document.uri.fsPath)) {
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

export class ApexLibraryExecuteExecutor extends ApexLibraryExecutor {
  protected executeService: ExecuteService | undefined;

  public createService(conn: Connection): void {
    this.executeService = new ExecuteService(conn);
  }

  public async execute(
    response: ContinueResponse<{ fileName?: string; apexCode?: string }>
  ): Promise<void> {
    this.setStartTime();

    try {
      await this.build(
        nls.localize('apex_execute_text'),
        nls.localize('force_apex_execute_library')
      );

      if (this.executeService === undefined) {
        throw new Error('ExecuteService is not established');
      }

      this.executeService.executeAnonymous = this.executeWrapper(
        this.executeService.executeAnonymous
      );

      await this.executeService.executeAnonymous({
        ...(response.data.fileName && { apexFilePath: response.data.fileName }),
        ...(response.data.apexCode && { apexCode: response.data.apexCode })
      });
    } catch (e) {
      telemetryService.sendException('force_apex_execute_library', e.message);
      notificationService.showFailedExecution(this.executionName);
      channelService.appendLine(e.message);
    }
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
