/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LogRecord, LogService } from '@salesforce/apex-node-bundle';
import {
  CancelResponse,
  ContinueResponse,
  LibraryCommandletExecutor,
  optionYYYYMMddHHmmss,
  ParametersGatherer,
  projectPaths,
  SfCommandlet,
  SfWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { workspaceContext } from '../context';
import { nls } from '../messages';

const LOG_DIRECTORY = projectPaths.debugLogsFolder();

type ApexDebugLogItem = vscode.QuickPickItem & {
  id: string;
  startTime: string;
};

export type ApexDebugLogIdStartTime = {
  id: string;
  startTime: string;
};

export class LogFileSelector implements ParametersGatherer<ApexDebugLogIdStartTime> {
  public async gather(): Promise<CancelResponse | ContinueResponse<ApexDebugLogIdStartTime>> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const logInfos = await this.getLogRecords();

    if (logInfos && logInfos.length > 0) {
      const logItems = logInfos.map(logInfo => {
        const icon = '$(file-text) ';
        const localUTCDate = new Date(logInfo.StartTime);
        const localDateFormatted = localUTCDate.toLocaleDateString(undefined, optionYYYYMMddHHmmss);

        return {
          id: logInfo.Id,
          label: icon + logInfo.LogUser.Name + ' - ' + logInfo.Operation,
          startTime: localDateFormatted,
          detail: localDateFormatted + ' - ' + logInfo.Status.substring(0, 150),
          description: `${(logInfo.LogLength / 1024).toFixed(2)} KB`
        } as ApexDebugLogItem;
      });
      const logItem = await vscode.window.showQuickPick(
        logItems,
        { placeHolder: nls.localize('apex_log_get_pick_log_text') },
        cancellationTokenSource.token
      );
      if (logItem) {
        return {
          type: 'CONTINUE',
          data: { id: logItem.id, startTime: logItem.startTime }
        };
      }
    } else {
      return {
        type: 'CANCEL',
        msg: nls.localize('apex_log_get_no_logs_text')
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
        title: nls.localize('apex_log_list_text')
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
export class ApexLibraryGetLogsExecutor extends LibraryCommandletExecutor<{
  id: string;
}> {
  constructor() {
    super(nls.localize('apex_log_get_text'), 'apex_log_get_library', OUTPUT_CHANNEL);
  }

  public async run(response: ContinueResponse<{ id: string }>): Promise<boolean> {
    const connection = await workspaceContext.getConnection();
    const logService = new LogService(connection);
    const { id: logId } = response.data;

    const logResults = await logService.getLogs({
      logId,
      outputDir: LOG_DIRECTORY
    });
    logResults.forEach(logResult => OUTPUT_CHANNEL.appendLine(logResult.log));

    const logPath = logResults[0].logPath;
    if (logPath) {
      const document = await vscode.workspace.openTextDocument(logPath);
      void vscode.window.showTextDocument(document);
    }

    return true;
  }
}

export const apexLogGet = async (explorerDir?: any) => {
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new LogFileSelector(),
    new ApexLibraryGetLogsExecutor()
  );
  await commandlet.run();
};
