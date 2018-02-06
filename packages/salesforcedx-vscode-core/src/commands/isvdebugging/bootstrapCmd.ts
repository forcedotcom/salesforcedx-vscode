/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandExecution,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { ExecOptions } from 'child_process';
import * as path from 'path';
import * as querystring from 'querystring';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
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

  public async execute(
    response: ContinueResponse<IsvDebugBootstrapConfig>
  ): Promise<void> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const projectParentPath = response.data.projectUri;
    const projectPath = path.join(projectParentPath, response.data.projectName);

    await Promise.resolve()
      .then(
        // 1: create project
        this.executeCommand(
          this.buildCreateProjectCommand(response.data),
          {
            cwd: projectParentPath
          },
          cancellationTokenSource,
          cancellationToken
        )
      )
      .then(
        // 2: configure project
        this.executeCommand(
          this.buildConfigureProjectCommand(response.data),
          {
            cwd: projectPath
          },
          cancellationTokenSource,
          cancellationToken
        )
      )
      .then(async () => {
        // last step: open the folder in VS Code
        await vscode.commands.executeCommand(
          'vscode.openFolder',
          vscode.Uri.parse(projectPath)
        );
      });
  }

  public executeCommand(
    command: Command,
    options: ExecOptions,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ): () => Promise<string> {
    return () => {
      const execution = new CliCommandExecutor(command, options).execute(
        cancellationToken
      );

      const result = new CommandOutput().getCmdResult(execution);

      this.attachExecution(
        execution,
        cancellationTokenSource,
        cancellationToken
      );

      return result;
    };
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
    const forceIdeUri = await vscode.window.showInputBox({
      prompt: nls.localize('parameter_gatherer_paste_forceide_url')
    });

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
