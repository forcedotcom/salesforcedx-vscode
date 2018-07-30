/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as moment from 'moment';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import { mkdir } from 'shelljs';
import * as vscode from 'vscode';
import { CommandExecution } from '../../../salesforcedx-utils-vscode/out/src/cli/commandExecutor';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

export class ForceApexLogGetExecutor extends SfdxCommandletExecutor<
  ApexDebugLogIdStartTime
> {
  public build(data: ApexDebugLogIdStartTime): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_log_get_text'))
      .withArg('force:apex:log:get')
      .withFlag('--logid', data.id)
      .withJson()
      .build();
  }

  protected attachExecution(
    execution: CommandExecution,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ) {
    channelService.streamCommandStartStop(execution);
    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }

  public async execute(
    response: ContinueResponse<ApexDebugLogIdStartTime>
  ): Promise<void> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);
    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
    const result = await new CommandOutput().getCmdResult(execution);
    const resultJson = JSON.parse(result);
    if (resultJson.status === 0) {
      const logDir = path.join(
        vscode.workspace.workspaceFolders![0].uri.fsPath,
        '.sfdx',
        'tools',
        'debug',
        'logs'
      );
      if (!fs.existsSync(logDir)) {
        mkdir('-p', logDir);
      }

      const date = moment(new Date(response.data.startTime)).format(
        'YYYYMMDDhhmmss'
      );
      const logPath = path.join(logDir, `${response.data.id}_${date}.log`);
      fs.writeFileSync(logPath, resultJson.result.log);
      const document = await vscode.workspace.openTextDocument(logPath);
      vscode.window.showTextDocument(document);
    }
  }
}

export type ApexDebugLogIdStartTime = {
  id: string;
  startTime: string;
};

export type ApexDebugLogObject = {
  Id: string;
  StartTime: string;
  LogLength: number;
  Operation: string;
  Request: string;
};

interface ApexDebugLogItem extends vscode.QuickPickItem {
  id: string;
}

export class LogFileSelector
  implements ParametersGatherer<ApexDebugLogIdStartTime> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ApexDebugLogIdStartTime>
  > {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const logInfos = await ForceApexLogList.getLogs(cancellationTokenSource);
    if (logInfos.length > 0) {
      const logItems = logInfos.map(logInfo => {
        const icon = '$(file-text) ';
        return {
          id: logInfo.Id,
          label: icon + logInfo.Operation,
          detail: moment(new Date(logInfo.StartTime)).format(
            'M/DD/YYYY, h:mm:s a'
          ),
          description: `${(logInfo.LogLength / 1024).toFixed(2)} KB`
        } as ApexDebugLogItem;
      });
      const logItem = await vscode.window.showQuickPick(
        logItems,
        { placeHolder: nls.localize('force_apex_log_get_pick_log_text') },
        cancellationTokenSource.token
      );
      if (logItem) {
        return {
          type: 'CONTINUE',
          data: { id: logItem.id, startTime: logItem.detail! }
        };
      }
    } else {
      return {
        type: 'CANCEL',
        msg: nls.localize('force_apex_log_get_no_logs_text')
      } as CancelResponse;
    }
    return { type: 'CANCEL' };
  }
}

export class ForceApexLogList {
  public static async getLogs(
    cancellationTokenSource: vscode.CancellationTokenSource
  ): Promise<ApexDebugLogObject[]> {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withDescription(nls.localize('force_apex_log_list_text'))
        .withArg('force:apex:log:list')
        .withJson()
        .build(),
      { cwd: vscode.workspace.workspaceFolders![0].uri.fsPath }
    ).execute();
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.processErrorSubject as any) as Observable<Error | undefined>
    );
    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    try {
      const apexDebugLogObjects: ApexDebugLogObject[] = JSON.parse(result)
        .result;
      apexDebugLogObjects.sort((a, b) => {
        return (
          new Date(b.StartTime).valueOf() - new Date(a.StartTime).valueOf()
        );
      });
      return Promise.resolve(apexDebugLogObjects);
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new LogFileSelector();

export async function forceApexLogGet(explorerDir?: any) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceApexLogGetExecutor()
  );
  await commandlet.run();
}
