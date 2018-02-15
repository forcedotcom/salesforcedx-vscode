/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandBuilder,
  CommandExecution,
  CommandOutput,
  CompositeCliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  DirFileNameSelection,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import { mkdir } from 'shelljs';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { CancellableStatusBar, taskViewService } from '../statuses';
import {
  CompositeParametersGatherer,
  EmptyParametersGatherer,
  FilePathExistsChecker,
  SelectFileName,
  SelectPrioritizedDirPath,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

class ForceApexLogFetchExecutor extends SfdxCommandletExecutor<ApexDebugLogId> {
  private cancellationTokenSource = new vscode.CancellationTokenSource();
  private cancellationToken = this.cancellationTokenSource.token;

  public build(data: ApexDebugLogId): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_log_fetch_text'))
      .withArg('force:apex:log:get')
      .withFlag('--logid', data.id)
      .withArg('--json')
      .build();
  }

  public attachSubExecution(execution: CommandExecution) {
    channelService.streamCommandOutput(execution);
  }

  public async execute(
    response: ContinueResponse<ApexDebugLogId>
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
      fs.writeFile(
        path.join(logDir, `${response.data.id}.log`),
        resultJson.result.log
      );
    }
  }
}

export enum ApexDebugLogRequest {
  Api = 'Api',
  Application = 'Application'
}

export type ApexDebugLogInfo = ApexDebugLogId & {
  operation: string;
  startTime: string;
  loglength: number;
  requestType: ApexDebugLogRequest;
};

export type ApexDebugLogId = {
  id: string;
};

export type ApexDebugLogObject = {
  Id: string;
  StartTime: string;
  LogLength: number;
  Operation: string;
  Request: string;
};

export async function getLogs(
  cancellationTokenSource: vscode.CancellationTokenSource
): Promise<ApexDebugLogInfo[]> {
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withDescription('Fetching logs')
      .withArg('force:apex:log:list')
      .withArg('--json')
      .build(),
    { cwd: vscode.workspace.workspaceFolders![0].uri.fsPath }
  ).execute();
  CancellableStatusBar.show(execution, cancellationTokenSource);
  taskViewService.addCommandExecution(execution, cancellationTokenSource);
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  try {
    const apexDebugLogInfos: ApexDebugLogInfo[] = [];
    const logGetJson: ApexDebugLogObject[] = JSON.parse(result).result;
    logGetJson.forEach(log => {
      const logInfo: ApexDebugLogInfo = {
        id: log.Id,
        operation: log.Operation,
        startTime: log.StartTime,
        loglength: log.LogLength,
        requestType: log.Request
      } as ApexDebugLogInfo;
      apexDebugLogInfos.push(logInfo);
    });
    apexDebugLogInfos.sort(function(a, b): number {
      return new Date(a.startTime).valueOf() - new Date(b.startTime).valueOf();
    });
    return Promise.resolve(apexDebugLogInfos);
  } catch (e) {
    return Promise.reject(result);
  }
}

export interface ApexDebugLogItem extends vscode.QuickPickItem {
  id: string;
}

export class LogFileSelector implements ParametersGatherer<ApexDebugLogId> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ApexDebugLogId>
  > {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const logInfos = await getLogs(cancellationTokenSource);
    if (logInfos.length > 0) {
      const logItems = logInfos.map(logInfo => {
        return {
          id: logInfo.id,
          label: logInfo.operation,
          description: logInfo.startTime,
          detail: String(logInfo.loglength)
        } as ApexDebugLogItem;
      });
      const logItem = await vscode.window.showQuickPick(
        logItems,
        { placeHolder: 'pick a log' },
        cancellationTokenSource.token
      );
      if (logItem) {
        return { type: 'CONTINUE', data: { id: logItem.id } };
      }
    } else {
      return { type: 'CANCEL', msg: 'No logs were found' } as CancelResponse;
    }
    return { type: 'CANCEL' };
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new LogFileSelector();

export async function forceApexLogFetch(explorerDir?: any) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceApexLogFetchExecutor()
  );
  commandlet.run();
}
