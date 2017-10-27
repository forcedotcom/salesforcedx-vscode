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
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { CancellableStatusBar, taskViewService } from '../statuses';
import {
  CancelResponse,
  CompositeParametersGatherer,
  ContinueResponse,
  EmptyPreChecker,
  ParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor
} from './commands';
import { ReplaySubject } from 'rxjs/ReplaySubject';

class ForceProjectCreateExecutor extends SfdxCommandletExecutor<{}> {
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

type ProjectNameAndPath = ProjectName & ProjectURI;

export interface ProjectURI {
  projectUri: string;
}

export class SelectProjectFolder implements ParametersGatherer<ProjectURI> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ProjectURI>
  > {
    const projectUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Create Project'
    } as vscode.OpenDialogOptions);
    return projectUri && projectUri.length === 1
      ? { type: 'CONTINUE', data: { projectUri: projectUri[0].fsPath } }
      : { type: 'CANCEL' };
  }
}

const workspaceChecker = new EmptyPreChecker();
const parameterGatherer = new CompositeParametersGatherer(
  new SelectProjectName(),
  new SelectProjectFolder()
);
const executor = new ForceProjectCreateExecutor();
const commandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  executor
);

export function forceProjectCreate() {
  commandlet.run();
}
