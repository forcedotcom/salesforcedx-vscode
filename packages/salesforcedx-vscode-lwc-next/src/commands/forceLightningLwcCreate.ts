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
  DirFileNameSelection,
  PostconditionChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const ProgressNotification = sfdxCoreExports.ProgressNotification;
const CompositeParametersGatherer = sfdxCoreExports.CompositeParametersGatherer;
const SelectFileName = sfdxCoreExports.SelectFileName;
const SelectStrictDirPath = sfdxCoreExports.SelectStrictDirPath;
const SfdxCommandlet = sfdxCoreExports.SfdxCommandlet;
const SfdxCommandletExecutor = sfdxCoreExports.SfdxCommandletExecutor;
const SfdxWorkspaceChecker = sfdxCoreExports.SfdxWorkspaceChecker;
const channelService = sfdxCoreExports.channelService;
const notificationService = sfdxCoreExports.notificationService;
const taskViewService = sfdxCoreExports.taskViewService;

const LIGHTNING_LWC_EXTENSION = '.js';

export class LightningFilePathExistsChecker
  implements PostconditionChecker<DirFileNameSelection> {
  public async check(
    inputs: ContinueResponse<DirFileNameSelection> | CancelResponse
  ): Promise<ContinueResponse<DirFileNameSelection> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      const baseFileName = path.join(
        inputs.data.outputdir,
        inputs.data.fileName,
        inputs.data.fileName
      );
      const files = await vscode.workspace.findFiles(
        `{${baseFileName}${LIGHTNING_LWC_EXTENSION},${baseFileName}.html}`
      );
      // If file does not exist then create it, otherwise prompt user to overwrite the file
      if (files.length === 0) {
        return inputs;
      } else {
        const overwrite = await notificationService.showWarningMessage(
          nls.localize('warning_prompt_lightning_bundle_overwrite'),
          nls.localize('warning_prompt_overwrite_confirm'),
          nls.localize('warning_prompt_overwrite_cancel')
        );
        if (overwrite === nls.localize('warning_prompt_overwrite_confirm')) {
          return inputs;
        }
      }
    }
    return { type: 'CANCEL' };
  }
}

class ForceLightningLwcCreateExecutor extends (SfdxCommandletExecutor as {
  new (): any;
}) {
  constructor() {
    super();
  }
  public build(data: DirFileNameSelection): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_lightning_lwc_create_text'))
      .withArg('force:lightning:component:create')
      .withFlag('--type', 'lwc')
      .withFlag('--componentname', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .build();
  }

  public execute(response: ContinueResponse<DirFileNameSelection>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(async data => {
      if (
        data !== undefined &&
        data.toString() === '0' &&
        vscode.workspace.rootPath
      ) {
        vscode.workspace
          .openTextDocument(
            path.join(
              vscode.workspace.rootPath,
              response.data.outputdir,
              // fileName is also used to create a subdirectory for the app in the lightningcomponents directory
              response.data.fileName,
              response.data.fileName + LIGHTNING_LWC_EXTENSION
            )
          )
          .then(document => vscode.window.showTextDocument(document));
      }
    });

    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.stderrSubject as any) as Observable<Error | undefined>
    );
    telemetryService.sendCommandEvent(
      'force_lightning_lwc_next_component_create'
    );
    channelService.streamCommandOutput(execution);
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const fileNameGatherer = new SelectFileName();
const lightningFilePathExistsChecker = new LightningFilePathExistsChecker();

export async function forceLightningLwcCreate(explorerDir?: any) {
  const outputDirGatherer = new SelectStrictDirPath(
    explorerDir,
    'lightningcomponents'
  );
  const parameterGatherer = new CompositeParametersGatherer(
    fileNameGatherer,
    outputDirGatherer
  );
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceLightningLwcCreateExecutor(),
    lightningFilePathExistsChecker
  );
  commandlet.run();
}
