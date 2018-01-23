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
import { exec } from 'child_process';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { CommandExecution } from '../../../../salesforcedx-utils-vscode/out/src/cli/commandExecutor';
import { channelService } from '../../channels';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { CancellableStatusBar, taskViewService } from '../../statuses';
import {
  CancelResponse,
  CompositeParametersGatherer,
  ContinueResponse,
  EmptyPreChecker,
  ParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor
} from '../commands';
import {
  PathExistsChecker,
  ProjectNameAndPath,
  SelectProjectFolder,
  SelectProjectName
} from '../forceProjectCreate';

export class IsvDebugBootstrapExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    throw new Error('not in use');
  }

  public buildCreateProjectCommand(data: IsvDebugBootstrapConfig): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('isv_debug_bootstrap_step1_create_project'))
      .withArg('force:project:create')
      .withFlag('--projectname', data.projectName)
      .withFlag('--outputdir', data.projectUri)
      .build();
  }

  public buildConfigureProjectCommand(data: IsvDebugBootstrapConfig): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('isv_debug_bootstrap_step1_configure_project')
      )
      .withArg('force:project:create')
      .withFlag('--projectname', data.projectName)
      .withFlag('--outputdir', data.projectUri)
      .build();
  }

  public execute(response: ContinueResponse<IsvDebugBootstrapConfig>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const createProjectExecution = new CliCommandExecutor(
      this.buildCreateProjectCommand(response.data),
      {
        cwd: response.data.projectUri
      }
    ).execute(cancellationToken);

    createProjectExecution.processExitSubject.subscribe(async data => {
      if (data != undefined && data.toString() === '0') {
        const configureProjectCommand = `echo '${response.data
          .forceIdeUri}' > .sfdx/isvsettings.test`;
        await exec(configureProjectCommand, (err, stdout, stderr) => {
          if (stderr && err) {
            console.log('configureProjectCommand:stderr', stderr);
            return;
          }

          console.log(stdout);
        });

        // const configureProjectExecution = new CliCommandExecutor(
        //   this.buildConfigureProjectCommand(response.data),
        //   {
        //     cwd: response.data.projectUri
        //   }
        // ).execute(cancellationToken);
        //
        // configureProjectExecution.processExitSubject(async data2 => {
        //   if (data2 != undefined && data2.toString() === '0') {
        //     channelService.streamCommandOutput
        // });
        //
        // this.attachExecution(
        //   configureProjectExecution,
        //   cancellationTokenSource,
        //   cancellationToken
        // );

        // last step is open the folder
        await vscode.commands.executeCommand(
          'vscode.openFolder',
          vscode.Uri.parse(
            path.join(response.data.projectUri, response.data.projectName)
          )
        );
      }
    });

    this.attachExecution(
      createProjectExecution,
      cancellationTokenSource,
      cancellationToken
    );
  }

  protected attachExecution(
    execution: CommandExecution,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ) {
    channelService.streamCommandOutput(execution);
    channelService.showChannelOutput();
    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.stderrSubject as any) as Observable<Error | undefined>
    );
    CancellableStatusBar.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

export type IsvDebugBootstrapConfig = ProjectNameAndPath & ForceIdeUri;

export interface ForceIdeUri {
  forceIdeUri: string;
}

export class EnterForceIdeUri implements ParametersGatherer<ForceIdeUri> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ForceIdeUri>
  > {
    const forceIdeUrlInputOptions = {
      prompt: nls.localize('parameter_gatherer_paste_forceide_url')
    } as vscode.InputBoxOptions;
    const forceIdeUri = await vscode.window.showInputBox(
      forceIdeUrlInputOptions
    );
    return forceIdeUri
      ? { type: 'CONTINUE', data: { forceIdeUri } }
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
