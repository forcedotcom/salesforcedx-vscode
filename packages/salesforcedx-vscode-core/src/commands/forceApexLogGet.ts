/*
 * Copyright (c) 2017, salesforce.com, inc.
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
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import { mkdir } from 'shelljs';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { CancellableStatusBar, taskViewService } from '../statuses';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

class ForceApexLogGetExecutor extends SfdxCommandletExecutor<
  ApexDebugLogIdStartTime
> {
  public build(data: ApexDebugLogIdStartTime): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_log_get_text'))
      .withArg('force:apex:log:get')
      .withFlag('--logid', data.id)
      .withArg('--json')
      .build();
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
    const resultPromise = new CommandOutput().getCmdResult(execution);
    const result = await resultPromise;
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
      const date = new Date(response.data.startTime)
        .toISOString()
        .replace('T', ' ')
        .replace('.000', '');
      fs.writeFile(
        path.join(logDir, `${response.data.id}_${date}.log`),
        resultJson.result.log
      );
    }
  }
}

enum ApexDebugLogRequest {
  Api = 'Api',
  Application = 'Application'
}

type ApexDebugLogIdStartTime = {
  id: string;
  startTime: string;
};

type ApexDebugLogObject = {
  Id: string;
  StartTime: string;
  LogLength: number;
  Operation: string;
  Request: string;
};

async function getLogs(
  cancellationTokenSource: vscode.CancellationTokenSource
): Promise<ApexDebugLogObject[]> {
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_log_list_text'))
      .withArg('force:apex:log:list')
      .withArg('--json')
      .build(),
    { cwd: vscode.workspace.workspaceFolders![0].uri.fsPath }
  ).execute();
  CancellableStatusBar.show(execution, cancellationTokenSource);
  taskViewService.addCommandExecution(execution, cancellationTokenSource);
  notificationService.reportExecutionError(
    execution.command.toString(),
    (execution.processErrorSubject as any) as Observable<Error | undefined>
  );
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  try {
    const apexDebugLogObjects: ApexDebugLogObject[] = JSON.parse(result).result;
    apexDebugLogObjects.sort(function(a, b): number {
      return new Date(b.StartTime).valueOf() - new Date(a.StartTime).valueOf();
    });
    return Promise.resolve(apexDebugLogObjects);
  } catch (e) {
    return Promise.reject(e);
  }
}

interface ApexDebugLogItem extends vscode.QuickPickItem {
  id: string;
}

class LogFileSelector implements ParametersGatherer<ApexDebugLogIdStartTime> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ApexDebugLogIdStartTime>
  > {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const logInfos = await getLogs(cancellationTokenSource);
    if (logInfos.length > 0) {
      const logItems = logInfos.map(logInfo => {
        let icon = '$(alert) ';
        switch (logInfo.Request) {
          case ApexDebugLogRequest.Api:
            icon = '$(rocket) ';
            break;
          case ApexDebugLogRequest.Application:
            icon = '$(squirrel) ';
            break;
        }
        return {
          id: logInfo.Id,
          label: icon + logInfo.Operation,
          description: new Date(logInfo.StartTime).toLocaleTimeString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          detail: `${(logInfo.LogLength / 1000).toFixed(2)} KB`
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
          data: { id: logItem.id, startTime: logItem.description }
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

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new LogFileSelector();

export async function forceApexLogGet(explorerDir?: any) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceApexLogGetExecutor()
  );
  commandlet.run();
}
