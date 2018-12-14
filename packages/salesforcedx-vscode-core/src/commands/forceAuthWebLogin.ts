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
export const PRODUCTION_URL = 'https://login.salesforce.com';
export const SANDBOX_URL = 'https://test.salesforce.com';

export class ForceAuthWebLoginExecutor extends SfdxCommandletExecutor<
  AuthParams
> {
  public build(data: AuthParams): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_auth_web_login_authorize_org_text'))
      .withArg('force:auth:web:login')
      .withFlag('--setalias', data.alias)
      .withFlag('--instanceurl', data.loginUrl)
      .withArg('--setdefaultusername')
      .withLogName('force_auth_web_login')
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
    this.logMetric(execution.command.logName);
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
  AuthParams
> {
  public build(data: AuthParams): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_auth_web_login_authorize_org_text'))
      .withArg('force:auth:web:login')
      .withFlag('--setalias', data.alias)
      .withFlag('--instanceurl', data.loginUrl)
      .withArg('--setdefaultusername')
      .withArg('--noprompt')
      .withJson()
      .withLogName('force_auth_web_login_demo_mode')
      .build();
  }
}

export class AuthParamsGatherer implements ParametersGatherer<AuthParams> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<AuthParams>
  > {
    const orgTypeItems: vscode.QuickPickItem[] = [
      { label: 'Production', detail: 'login.salesforce.com' },
      { label: 'Sandbox', detail: 'test.salesforce.com' },
      { label: 'Custom', detail: 'Use a custom login URL' }
    ];
    const selection = await vscode.window.showQuickPick(orgTypeItems);
    const orgType = (selection as vscode.QuickPickItem).label;
    let loginUrl: string | undefined;
    if (orgType === 'Custom') {
      const customUrlInputOptions = {
        prompt: nls.localize('parameter_gatherer_enter_custom_url'),
        placeHolder: PRODUCTION_URL
      };
      loginUrl = await vscode.window.showInputBox(customUrlInputOptions);
      if (loginUrl === undefined) {
        return { type: 'CANCEL' };
      }
    } else {
      loginUrl = orgType === 'Sandbox' ? SANDBOX_URL : PRODUCTION_URL;
    }

    const aliasInputOptions = {
      prompt: nls.localize('parameter_gatherer_enter_alias_name'),
      placeHolder: DEFAULT_ALIAS
    } as vscode.InputBoxOptions;
    const alias = await vscode.window.showInputBox(aliasInputOptions);
    // Hitting enter with no alias will default the alias to 'vscodeOrg'
    if (alias === undefined) {
      return { type: 'CANCEL' };
    }
    return {
      type: 'CONTINUE',
      data: {
        alias: alias || DEFAULT_ALIAS,
        loginUrl: loginUrl || PRODUCTION_URL
      }
    };
  }
}

export interface AuthParams {
  alias: string;
  loginUrl: string;
}

export async function promptLogOutForProdOrg() {
  await new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new DemoModePromptGatherer(),
    ForceAuthLogoutAll.withoutShowingChannel()
  ).run();
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new AuthParamsGatherer();

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
