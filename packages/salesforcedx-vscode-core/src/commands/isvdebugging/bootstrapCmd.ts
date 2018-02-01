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
import * as path from 'path';
import * as querystring from 'querystring';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { CommandExecution } from '../../../../salesforcedx-utils-vscode/out/src/cli/commandExecutor';
import { channelService } from '../../channels';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { CancellableStatusBar, taskViewService } from '../../statuses';
import {
  CompositeParametersGatherer,
  EmptyPreChecker,
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
      .withArg('force:config:set')
      .withArg(`isvDebuggerSid=${data.sessionId}`)
      .withArg(`isvDebuggerUrl=${data.loginUrl}`)
      .withArg(`instanceUrl=${data.loginUrl}`)
      .build();
  }

  public execute(response: ContinueResponse<IsvDebugBootstrapConfig>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const projectParentPath = response.data.projectUri;
    const projectPath = path.join(projectParentPath, response.data.projectName);

    const createProjectExecution = new CliCommandExecutor(
      this.buildCreateProjectCommand(response.data),
      {
        cwd: projectParentPath
      }
    ).execute(cancellationToken);

    createProjectExecution.processExitSubject.subscribe(async data => {
      if (data != undefined && data.toString() === '0') {
        const configureProjectExecution = new CliCommandExecutor(
          this.buildConfigureProjectCommand(response.data),
          {
            cwd: projectPath
          }
        ).execute(cancellationToken);

        configureProjectExecution.processExitSubject.subscribe(async data2 => {
          if (data2 != undefined && data2.toString() === '0') {
            // last step is open the folder
            await vscode.commands.executeCommand(
              'vscode.openFolder',
              vscode.Uri.parse(projectPath)
            );
          }
        });

        this.attachExecution(
          configureProjectExecution,
          cancellationTokenSource,
          cancellationToken
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
  loginUrl: string;
  sessionId: string;
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

    if (forceIdeUri) {
      const url = Uri.parse(forceIdeUri);
      const parameter = querystring.parse(url.query);
      if (parameter.url && parameter.sessionId) {
        return {
          type: 'CONTINUE',
          data: {
            loginUrl: parameter.url,
            sessionId: parameter.sessionId
          }
        };
      }

      vscode.window.showErrorMessage(
        nls.localize('parameter_gatherer_invalid_forceide_url')
      );
    }

    return { type: 'CANCEL' };
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
