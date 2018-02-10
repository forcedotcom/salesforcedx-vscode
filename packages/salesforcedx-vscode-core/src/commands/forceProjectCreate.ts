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
  ParametersGatherer,
  PostconditionChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { CancellableStatusBar, taskViewService } from '../statuses';
import {
  CompositeParametersGatherer,
  EmptyPreChecker,
  SfdxCommandlet,
  SfdxCommandletExecutor
} from './commands';

export class ForceProjectCreateExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: ProjectNameAndPath): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_project_create_text'))
      .withArg('force:project:create')
      .withFlag('--projectname', data.projectName)
      .withFlag('--outputdir', data.projectUri)
      .build();
  }

  public execute(response: ContinueResponse<ProjectNameAndPath>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: response.data.projectUri
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(async data => {
      if (data != undefined && data.toString() === '0') {
        await vscode.commands.executeCommand(
          'vscode.openFolder',
          vscode.Uri.parse(
            path.join(response.data.projectUri, response.data.projectName)
          )
        );
      }
    });

    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.stderrSubject as any) as Observable<Error | undefined>
    );
    channelService.streamCommandOutput(execution);
    CancellableStatusBar.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

export type ProjectNameAndPath = ProjectName & ProjectURI;

export interface ProjectURI {
  projectUri: string;
}

export interface ProjectName {
  projectName: string;
}

export class SelectProjectName implements ParametersGatherer<ProjectName> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ProjectName>
  > {
    const projectNameInputOptions = {
      prompt: nls.localize('parameter_gatherer_enter_project_name')
    } as vscode.InputBoxOptions;
    const projectName = await vscode.window.showInputBox(
      projectNameInputOptions
    );
    return projectName
      ? { type: 'CONTINUE', data: { projectName } }
      : { type: 'CANCEL' };
  }
}

export class SelectProjectFolder implements ParametersGatherer<ProjectURI> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ProjectURI>
  > {
    const projectUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: nls.localize('force_project_create_open_dialog_create_label')
    } as vscode.OpenDialogOptions);
    return projectUri && projectUri.length === 1
      ? { type: 'CONTINUE', data: { projectUri: projectUri[0].fsPath } }
      : { type: 'CANCEL' };
  }
}

export class PathExistsChecker
  implements PostconditionChecker<ProjectNameAndPath> {
  public async check(
    inputs: ContinueResponse<ProjectNameAndPath> | CancelResponse
  ): Promise<ContinueResponse<ProjectNameAndPath> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      const pathExists = fs.existsSync(
        path.join(inputs.data.projectUri, `${inputs.data.projectName}/`)
      );
      if (!pathExists) {
        return inputs;
      } else {
        const overwrite = await notificationService.showWarningMessage(
          nls.localize('warning_prompt_dir_overwrite'),
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

const workspaceChecker = new EmptyPreChecker();
const parameterGatherer = new CompositeParametersGatherer(
  new SelectProjectName(),
  new SelectProjectFolder()
);
const pathExistsChecker = new PathExistsChecker();

const executor = new ForceProjectCreateExecutor();
const commandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  executor,
  pathExistsChecker
);

export function forceProjectCreate() {
  commandlet.run();
}
