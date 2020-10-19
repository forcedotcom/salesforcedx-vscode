/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LogService } from '@salesforce/apex-node';
import { LogRecord } from '@salesforce/apex-node/lib/src/logs/types';
import {
  CliCommandExecutor,
  Command,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
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
import { Observable } from 'rxjs/Observable';
import { mkdir } from 'shelljs';
import * as vscode from 'vscode';
import { CommandExecution } from '../../../salesforcedx-utils-vscode/out/src/cli/commandExecutor';
import { channelService } from '../channels';
import { SFDX_FOLDER } from '../constants';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { sfdxCoreSettings } from '../settings';
import { taskViewService } from '../statuses';
import { getRootWorkspacePath } from '../util';
import {
  LibraryCommandletExecutor,
  LibraryExecution,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

export class ForceApexLogGetExecutor extends SfdxCommandletExecutor<
  ApexDebugLogIdStartTime
  > {
  public build(data: ApexDebugLogIdStartTime): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_log_get_text'))
      .withArg('force:apex:log:get')
      .withFlag('--logid', data.id)
      .withJson()
      .withLogName('force_apex_log_get')
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
      const logDir = path.join(
        getRootWorkspacePath(),
        '.sfdx',
        'tools',
        'debug',
        'logs'
      );
      if (!fs.existsSync(logDir)) {
        mkdir('-p', logDir);
      }

      const localUTCDate = new Date(response.data.startTime);
      const date = getYYYYMMddHHmmssDateFormat(localUTCDate);
      const logPath = path.join(logDir, `${response.data.id}_${date}.log`);
      // this needs to be result[0] for this to work correctly but idk if that used to be necessary
      fs.writeFileSync(logPath, resultJson.result[0].log);
      const document = await vscode.workspace.openTextDocument(logPath);
      vscode.window.showTextDocument(document);
    }
  }
}

export type ApexDebugLogIdStartTime = {
  id: string;
  startTime: string;
};

export type ApexDebugLogUser = {
  Name: string;
};

export type ApexDebugLogObject = {
  Id: string;
  StartTime: string;
  LogLength: number;
  Operation: string;
  Request: string;
  Status: string;
  LogUser: ApexDebugLogUser;
};

interface ApexDebugLogItem extends vscode.QuickPickItem {
  id: string;
  startTime: string;
}

export class LogFileSelector
  implements ParametersGatherer<ApexDebugLogIdStartTime> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ApexDebugLogIdStartTime>
  > {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const logInfos = sfdxCoreSettings.getApexLibrary()
      ? (
        await new ApexLibraryLogListExecutor().execute(
          {} as ContinueResponse<{}>
        )
      ).result
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
        .withLogName('force_apex_log_list')
        .build(),
      { cwd: getRootWorkspacePath() }
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

export class ApexLibraryGetLogsExecutor extends LibraryCommandletExecutor<{ id: string; }> {
  protected executionName: string = nls.localize('apex_log_get_text');
  protected logName: string = 'force_apex_log_get_library';

  protected async run(
    response: ContinueResponse<{ id: string }>
  ): Promise<LibraryExecution> {
    const connection = await workspaceContext.getConnection();
    // @ts-ignore
    const logService = new LogService(connection);
    const { id: logId } = response.data;
    const outputDir = path.join(
      getRootWorkspacePath(),
      SFDX_FOLDER,
      'tools',
      'debug',
      'logs'
    );

    await logService.getLogs({ logId, outputDir });

    const logPath = path.join(outputDir, `${logId}.log`);
    const document = await vscode.workspace.openTextDocument(logPath);
    vscode.window.showTextDocument(document);

    return { success: true };
  }
}

export class ApexLibraryLogListExecutor extends LibraryCommandletExecutor<{}, LogRecord[]> {
  protected executionName: string = nls.localize('apex_log_list_text');
  protected logName: string = 'force_apex_log_list_library';

  protected async run(
    response: ContinueResponse<{}>
  ): Promise<LibraryExecution<LogRecord[]>> {
    const connection = await workspaceContext.getConnection();
    // @ts-ignore
    const logService = new LogService(connection);
    const logs = await logService.getLogRecords();

    return { success: true, result: logs };
  }
}

export async function forceApexLogGet(explorerDir?: any) {
  const parameterGatherer = new LogFileSelector();
  const logGetExecutor = sfdxCoreSettings.getApexLibrary()
    ? new ApexLibraryGetLogsExecutor()
    : new ForceApexLogGetExecutor();

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    parameterGatherer,
    logGetExecutor
  );
  await commandlet.run();
}
