/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { CliCommandExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/commandExecutor';
import { CommandOutput } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/commandOutput';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types/index';
import { Observable } from 'rxjs/Observable';
import { CancellationTokenSource, workspace } from 'vscode';
import { channelService } from '../channels/index';
import { nls } from '../messages';
import { isDemoMode, isProdOrg } from '../modes/demo-mode';
import {
  notificationService,
  ProgressNotification
} from '../notifications/index';
import { taskViewService } from '../statuses/index';
import {
  DemoModePromptGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';
import { ForceAuthLogoutAll } from './forceAuthLogout';

export const DEFAULT_ALIAS = 'vscodeOrg';

export class ForceAuthWebLoginExecutor extends SfdxCommandletExecutor<Alias> {
  public build(data: Alias): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_auth_web_login_authorize_org_text'))
      .withArg('force:auth:web:login')
      .withFlag('--setalias', data.alias)
      .withArg('--setdefaultusername')
      .build();
  }
}

export abstract class ForceAuthDemoModeExecutor<
  T
> extends SfdxCommandletExecutor<T> {
  public async execute(response: ContinueResponse<T>): Promise<void> {
    const cancellationTokenSource = new CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspace.rootPath
    }).execute(cancellationToken);

    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.stderrSubject as any) as Observable<Error | undefined>
    );

    channelService.streamCommandOutput(execution);
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);

    try {
      const result = await new CommandOutput().getCmdResult(execution);
      if (isProdOrg(JSON.parse(result))) {
        await promptLogOutForProdOrg();
      } else {
        await notificationService.showSuccessfulExecution(
          execution.command.toString()
        );
      }
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
}

export class ForceAuthWebLoginDemoModeExecutor extends ForceAuthDemoModeExecutor<
  Alias
> {
  public build(data: Alias): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_auth_web_login_authorize_org_text'))
      .withArg('force:auth:web:login')
      .withFlag('--setalias', data.alias)
      .withArg('--setdefaultusername')
      .withArg('--noprompt')
      .withJson()
      .build();
  }
}

export class AliasGatherer implements ParametersGatherer<Alias> {
  public async gather(): Promise<CancelResponse | ContinueResponse<Alias>> {
    const aliasInputOptions = {
      prompt: nls.localize('parameter_gatherer_enter_alias_name'),
      placeHolder: DEFAULT_ALIAS
    } as vscode.InputBoxOptions;
    const alias = await vscode.window.showInputBox(aliasInputOptions);
    // Hitting enter with no alias will default the alias to 'vscodeOrg'
    if (alias === undefined) {
      return { type: 'CANCEL' };
    }
    return alias === ''
      ? { type: 'CONTINUE', data: { alias: DEFAULT_ALIAS } }
      : { type: 'CONTINUE', data: { alias } };
  }
}

export interface Alias {
  alias: string;
}

export async function promptLogOutForProdOrg() {
  await new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new DemoModePromptGatherer(),
    ForceAuthLogoutAll.withoutShowingChannel()
  ).run();
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new AliasGatherer();

export function createExecutor(): SfdxCommandletExecutor<{}> {
  return isDemoMode()
    ? new ForceAuthWebLoginDemoModeExecutor()
    : new ForceAuthWebLoginExecutor();
}

export async function forceAuthWebLogin() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    createExecutor()
  );
  await commandlet.run();
}
