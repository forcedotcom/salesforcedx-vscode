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
import * as fs from 'fs';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import { channelService } from 'salesforcedx-vscode-core/out/src/channels';
import {
  CancelResponse,
  CompositeParametersGatherer,
  ContinueResponse,
  EmptyPreChecker,
  ParametersGatherer,
  PostconditionChecker,
  SfdxCommandlet,
  SfdxCommandletExecutor
} from 'salesforcedx-vscode-core/out/src/commands/commands';
import {
  PathExistsChecker,
  ProjectName,
  ProjectNameAndPath,
  ProjectURI,
  SelectProjectFolder,
  SelectProjectName
} from 'salesforcedx-vscode-core/out/src/commands/forceProjectCreate';
import { nls } from 'salesforcedx-vscode-core/out/src/messages';
import { notificationService } from 'salesforcedx-vscode-core/out/src/notifications';
import {
  CancellableStatusBar,
  taskViewService
} from 'salesforcedx-vscode-core/out/src/statuses';
import * as vscode from 'vscode';

export class IsvDebugBootstrapExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: IsvDebugBootstrapConfig): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_project_create_text'))
      .withArg('force:project:create')
      .withFlag('--projectname', data.projectName)
      .withFlag('--outputdir', data.projectUri)
      .build();
  }

  public execute(response: ContinueResponse<IsvDebugBootstrapConfig>): void {
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

export type IsvDebugBootstrapConfig = ProjectNameAndPath & ForceIdeUri;

export interface ForceIdeUri {
  forceIdeUri: string;
}

export class EnterForceIdeUri implements ParametersGatherer<ProjectName> {
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

const workspaceChecker = new EmptyPreChecker();
const parameterGatherer = new CompositeParametersGatherer(
  new EnterForceIdeUri(),
  new SelectProjectName(),
  new SelectProjectFolder()
);
const pathExistsChecker = new PathExistsChecker();

const executor = new IsvDebugBootstrapExecutor();
const commandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  executor,
  pathExistsChecker
);

export function isvDebugBootstrap() {
  commandlet.run();
}
