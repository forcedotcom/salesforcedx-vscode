/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LogRecord, LogService } from '@salesforce/apex-node';
import {
  getRootWorkspacePath,
  getRootWorkspaceSfdxPath,
  LibraryCommandletExecutor,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  CliCommandExecutor,
  Command,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  notificationService,
  ProgressNotification
} from '@salesforce/salesforcedx-utils-vscode/out/src/commands';
import {
  getYYYYMMddHHmmssDateFormat,
  optionYYYYMMddHHmmss
} from '@salesforce/salesforcedx-utils-vscode/out/src/date';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as path from 'path';
import { mkdir } from 'shelljs';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import { useApexLibrary } from '../settings';

const LOG_DIRECTORY = path.join(
  getRootWorkspaceSfdxPath(),
  'tools',
  'debug',
  'logs'
);

interface ApexDebugLogItem extends vscode.QuickPickItem {
  id: string;
  startTime: string;
}

export type ApexDebugLogIdStartTime = {
  id: string;
  startTime: string;
};

export class LogFileSelector
  implements ParametersGatherer<ApexDebugLogIdStartTime> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ApexDebugLogIdStartTime>
  > {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const logInfos = useApexLibrary()
      ? await this.getLogRecords()
      : await ForceApexLogList.getLogs(cancellationTokenSource);

    if (logInfos && logInfos.length > 0) {
      const logItems = logInfos.map(logInfo => {
        const icon = '$(file-text) ';
        const localUTCDate = new Date(logInfo.StartTime);
        const localDateFormatted = localUTCDate.toLocaleDateString(
          undefined,
          optionYYYYMMddHHmmss
        );

        return {
          id: logInfo.Id,
          label: icon + logInfo.LogUser.Name + ' - ' + logInfo.Operation,
          startTime: localDateFormatted,
          detail: localDateFormatted + ' - ' + logInfo.Status.substr(0, 150),
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
          data: { id: logItem.id, startTime: logItem.startTime! }
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

  public async getLogRecords(): Promise<LogRecord[]> {
    const connection = await workspaceContext.getConnection();
    const logService = new LogService(connection);
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: nls.localize('force_apex_log_list_text')
      },
      () => logService.getLogRecords()
    );
  }
}

export type ApexDebugLogObject = {
  Id: string;
  StartTime: string;
  LogLength: number;
  Operation: string;
  Request: string;
  Status: string;
  LogUser: {
    Name: string;
  };
};

export class ForceApexLogList {
  public static async getLogs(
    cancellationTokenSource: vscode.CancellationTokenSource
  ): Promise<ApexDebugLogObject[]> {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withDescription(nls.localize('force_apex_log_list_text'))
        .withArg('force:apex:log:list')
        .withJson()
        .withLogName('force_apex_log_list')
        .build(),
      { cwd: getRootWorkspacePath() }
    ).execute();
    ProgressNotification.show(execution, cancellationTokenSource);
    notificationService.reportExecutionError(
      execution.command.toString(),
      execution.processErrorSubject
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

export class ForceApexLogGetExecutor extends SfdxCommandletExecutor<
  ApexDebugLogIdStartTime
> {
  constructor() {
    super(OUTPUT_CHANNEL);
  }

  public build(data: ApexDebugLogIdStartTime): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_log_get_text'))
      .withArg('force:apex:log:get')
      .withFlag('--logid', data.id)
      .withJson()
      .withLogName('force_apex_log_get')
      .build();
  }

  public async execute(
    response: ContinueResponse<ApexDebugLogIdStartTime>
  ): Promise<void> {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);
    this.attachExecution(execution, cancellationTokenSource, cancellationToken);

    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
    });


    const result = await new CommandOutput().getCmdResult(execution);
    const resultJson = JSON.parse(result);
    if (resultJson.status === 0) {
      if (!fs.existsSync(LOG_DIRECTORY)) {
        mkdir('-p', LOG_DIRECTORY);
      }

      const localUTCDate = new Date(response.data.startTime);
      const date = getYYYYMMddHHmmssDateFormat(localUTCDate);
      const logPath = path.join(
        LOG_DIRECTORY,
        `${response.data.id}_${date}.log`
      );
      const log = Array.isArray(resultJson.result)
        ? resultJson.result[0].log
        : resultJson.result.log;
      fs.writeFileSync(logPath, log);
      const document = await vscode.workspace.openTextDocument(logPath);
      vscode.window.showTextDocument(document);
    }
  }
}

export class ApexLibraryGetLogsExecutor extends LibraryCommandletExecutor<{
  id: string;
}> {
  constructor() {
    super(
      nls.localize('force_apex_log_get_text'),
      'force_apex_log_get_library',
      OUTPUT_CHANNEL
    );
  }

  public async run(
    response: ContinueResponse<{ id: string }>
  ): Promise<boolean> {
    const connection = await workspaceContext.getConnection();
    const logService = new LogService(connection);
    const { id: logId } = response.data;

    const {logs, logPaths} = await logService.getLogs({ logId, outputDir: LOG_DIRECTORY });
    logs.forEach(log => OUTPUT_CHANNEL.appendLine(log));

    if (logPaths) {
      const document = await vscode.workspace.openTextDocument(logPaths[0]);
      vscode.window.showTextDocument(document);
    }
    return true;
  }
}

export async function forceApexLogGet(explorerDir?: any) {
  const logGetExecutor = useApexLibrary()
    ? new ApexLibraryGetLogsExecutor()
    : new ForceApexLogGetExecutor();

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new LogFileSelector(),
    logGetExecutor
  );
  await commandlet.run();
}
