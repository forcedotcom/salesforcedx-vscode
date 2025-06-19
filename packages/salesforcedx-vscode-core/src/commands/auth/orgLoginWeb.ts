/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Command, CommandOutput, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  workspaceUtils,
  CliCommandExecutor,
  ContinueResponse,
  isSFContainerMode,
  ProgressNotification,
  TraceFlags
} from '@salesforce/salesforcedx-utils-vscode';
import { EOL } from 'node:os';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { CancellationTokenSource } from 'vscode';
import { URI } from 'vscode-uri';
import { channelService } from '../../channels/index';
import { CLI, TRACE_FLAG_EXPIRATION_KEY } from '../../constants';
import { WorkspaceContext } from '../../context';
import { disposeTraceFlagExpiration, showTraceFlagExpiration } from '../../decorators';
import { nls } from '../../messages';
import { isDemoMode, isProdOrg } from '../../modes/demoMode';
import { notificationService } from '../../notifications/index';
import { taskViewService } from '../../statuses/index';
import { telemetryService } from '../../telemetry';
import { DemoModePromptGatherer, SfCommandlet, SfCommandletExecutor, SfWorkspaceChecker } from '../util';
import { AuthParams, AuthParamsGatherer } from './authParamsGatherer';
import { OrgLogoutAll } from './orgLogout';

type DeviceCodeResponse = {
  user_code: string;
  device_code: string;
  interval: number;
  verification_uri: string;
};

const handleTraceFlagCleanupAfterLogin = async (extensionContext: vscode.ExtensionContext): Promise<void> => {

  // Change the status bar message to reflect the trace flag expiration date for the new target org

  // If there is a non-expired TraceFlag for the current user, update the status bar message
  const oldTraceFlags = new TraceFlags(await WorkspaceContext.getInstance().getConnection());
  await oldTraceFlags.getUserIdOrThrow(); // This line switches the connection to the new target org
  const newTraceFlags = new TraceFlags(await WorkspaceContext.getInstance().getConnection()); // Get the new connection after switching
  const newUserId = await newTraceFlags.getUserIdOrThrow();
  const myTraceFlag = await newTraceFlags.getTraceFlagForUser(newUserId);
  if (!myTraceFlag) {
    disposeTraceFlagExpiration();
    return;
  }

  const currentTime = new Date();
  if (myTraceFlag.ExpirationDate && new Date(myTraceFlag.ExpirationDate) > currentTime) {
    extensionContext.workspaceState.update(TRACE_FLAG_EXPIRATION_KEY, myTraceFlag.ExpirationDate);
  } else {
    extensionContext.workspaceState.update(TRACE_FLAG_EXPIRATION_KEY, undefined);
  }

  try {
    // Delete expired TraceFlags for the current user
    const traceFlags = new TraceFlags(await WorkspaceContext.getInstance().getConnection());

    const userId = await traceFlags.getUserIdOrThrow();

    const expiredTraceFlagExists = await traceFlags.deleteExpiredTraceFlags(userId);
    if (expiredTraceFlagExists) {
      extensionContext.workspaceState.update(TRACE_FLAG_EXPIRATION_KEY, undefined);
    }

    // Apex Replay Debugger Expiration Status Bar Entry
    const expirationDate = extensionContext.workspaceState.get<string>(TRACE_FLAG_EXPIRATION_KEY);
    if (expirationDate) {
      showTraceFlagExpiration(new Date(expirationDate));
    }
  } catch {
    console.log('No default org found, skipping trace flag expiration check after login');
  }
};

export class OrgLoginWebContainerExecutor extends SfCommandletExecutor<AuthParams> {
  protected showChannelOutput = false;
  protected deviceCodeReceived = false;
  protected stdOut = '';
  private extensionContext?: vscode.ExtensionContext;

  constructor(extensionContext?: vscode.ExtensionContext) {
    super();
    this.extensionContext = extensionContext;
  }

  public build(data: AuthParams): Command {
    const command = new SfCommandBuilder().withDescription(nls.localize('org_login_web_authorize_org_text'));

    command
      .withArg(CLI.ORG_LOGIN_DEVICE)
      .withLogName('org_login_web_container')
      .withFlag('--alias', data.alias)
      .withFlag('--instance-url', data.loginUrl)
      .withArg('--set-default')
      .withJson();

    return command.build();
  }

  public execute(response: ContinueResponse<AuthParams>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspaceUtils.getRootWorkspacePath(),
      env: { SF_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    channelService.streamCommandStartStop(execution);

    execution.stdoutSubject.subscribe(cliResponse => {
      const responseStr = cliResponse.toString();
      this.handleCliResponse(responseStr);
    });

    execution.processExitSubject.subscribe(async (exitCode) => {
      this.logMetric(execution.command.logName, startTime);

      // If the command completed successfully, clean up trace flags
      if (exitCode === 0 && this.extensionContext) {
        await handleTraceFlagCleanupAfterLogin(this.extensionContext);
      }
    });

    notificationService.reportCommandExecutionStatus(execution, cancellationToken);

    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }

  protected handleCliResponse(response: string) {
    // response may not be complete data, so we accumulate data as it comes in.
    this.stdOut += response;

    if (!this.deviceCodeReceived) {
      const authUrl = this.parseAuthUrlFromStdOut(this.stdOut);

      if (authUrl) {
        this.deviceCodeReceived = true;
        // open the default browser
        vscode.env.openExternal(URI.parse(authUrl, true));
      }
    }
  }

  private parseAuthUrlFromStdOut(stdOut: string): string | undefined {
    try {
      // remove when we drop CLI invocations
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const response = JSON.parse(stdOut) as DeviceCodeResponse;
      const verificationUrl = response.verification_uri;
      const userCode = response.user_code;

      if (verificationUrl && userCode) {
        const authUrl = `${verificationUrl}?user_code=${userCode}&prompt=login`;
        this.logToOutputChannel(userCode, verificationUrl);
        return authUrl;
      }
    } catch (error) {
      channelService.appendLine(nls.localize('org_login_device_code_parse_error'));
      telemetryService.sendException(
        'org_login_web_container',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `There was an error when parsing the cli response ${error}`
      );
    }
  }

  private logToOutputChannel(code: string, url: string) {
    channelService.appendLine(`${EOL}`);
    channelService.appendLine(nls.localize('action_required'));
    channelService.appendLine(nls.localize('org_login_device_enter_code', code, url));
    channelService.appendLine(`${EOL}`);
  }
}

class OrgLoginWebExecutor extends SfCommandletExecutor<AuthParams> {
  protected showChannelOutput = false;
  private extensionContext?: vscode.ExtensionContext;

  constructor(extensionContext?: vscode.ExtensionContext) {
    super();
    this.extensionContext = extensionContext;
  }

  public build(data: AuthParams): Command {
    const command = new SfCommandBuilder().withDescription(nls.localize('org_login_web_authorize_org_text'));

    command
      .withArg(CLI.ORG_LOGIN_WEB)
      .withLogName('org_login_web')
      .withFlag('--alias', data.alias)
      .withFlag('--instance-url', data.loginUrl)
      .withArg('--set-default');

    return command.build();
  }

  public execute(response: ContinueResponse<AuthParams>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: this.executionCwd,
      env: { SF_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    let output = '';
    execution.stdoutSubject.subscribe(realData => {
      output += realData.toString();
    });

    execution.processExitSubject.subscribe(exitCode => {
      const telemetryData = this.getTelemetryData(exitCode === 0, response, output);
      let properties;
      let measurements;
      if (telemetryData) {
        properties = telemetryData.properties;
        measurements = telemetryData.measurements;
      }
      this.logMetric(execution.command.logName, startTime, properties, measurements);
      this.onDidFinishExecutionEventEmitter.fire(startTime);

      // If the command completed successfully, clean up trace flags
      if (exitCode === 0 && this.extensionContext) {
        void handleTraceFlagCleanupAfterLogin(this.extensionContext);
      }
    });
    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }
}

export abstract class AuthDemoModeExecutor<T> extends SfCommandletExecutor<T> {
  protected extensionContext?: vscode.ExtensionContext;

  constructor(extensionContext?: vscode.ExtensionContext) {
    super();
    this.extensionContext = extensionContext;
  }

  public async execute(response: ContinueResponse<T>): Promise<void> {
    const startTime = process.hrtime();
    const cancellationTokenSource = new CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspaceUtils.getRootWorkspacePath()
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
    });

    notificationService.reportExecutionError(
      execution.command.toString(),
      // TODO: fix when we update rxjs
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      execution.stderrSubject as any as Observable<Error | undefined>
    );

    channelService.streamCommandOutput(execution);
    void ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);

    try {
      const result = await new CommandOutput().getCmdResult(execution);
      if (isProdOrg(JSON.parse(result))) {
        await promptLogOutForProdOrg();
      } else {
        await notificationService.showSuccessfulExecution(execution.command.toString());
      }

      // Clean up trace flags after successful login
      if (this.extensionContext) {
        await handleTraceFlagCleanupAfterLogin(this.extensionContext);
      }

      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
}

class OrgLoginWebDemoModeExecutor extends AuthDemoModeExecutor<AuthParams> {
  public build(data: AuthParams): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('org_login_web_authorize_org_text'))
      .withArg(CLI.ORG_LOGIN_WEB)
      .withFlag('--alias', data.alias)
      .withFlag('--instance-url', data.loginUrl)
      .withArg('--set-default')
      .withArg('--no-prompt')
      .withJson()
      .withLogName('org_login_web_demo_mode')
      .build();
  }
}

const promptLogOutForProdOrg = async () => {
  await new SfCommandlet(
    new SfWorkspaceChecker(),
    new DemoModePromptGatherer(),
    OrgLogoutAll.withoutShowingChannel()
  ).run();
};

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new AuthParamsGatherer();

const createOrgLoginWebExecutor = (extensionContext?: vscode.ExtensionContext): SfCommandletExecutor<{}> => {
  switch (true) {
    case isSFContainerMode():
      return new OrgLoginWebContainerExecutor(extensionContext);
    case isDemoMode():
      return new OrgLoginWebDemoModeExecutor(extensionContext);
    default:
      return new OrgLoginWebExecutor(extensionContext);
  }
};

export const orgLoginWeb = async (extensionContext?: vscode.ExtensionContext): Promise<void> => {
  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, createOrgLoginWebExecutor(extensionContext));
  await commandlet.run();
  console.log('orgLoginWeb command executed');
};
