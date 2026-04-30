/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type Column, createTable, type Row } from '@salesforce/effect-ext-utils';
import * as vscode from 'vscode';
import { channelService } from './channels';
import { APEX_LSP_ORPHAN } from './constants';
import { findAndCheckOrphanedProcesses, terminateProcess } from './languageUtils';
import { ProcessDetail } from './languageUtils/languageClientManager';
import { nls } from './messages';
import { getTelemetryService } from './telemetry/telemetry';

// these messages contain replaceable parameters, cannot localize yet

const resolveAnyFoundOrphanLanguageServers = async (): Promise<void> => {
  const telemetryService = getTelemetryService();
  const orphanedProcesses = await findAndCheckOrphanedProcesses();
  if (orphanedProcesses.length > 0) {
    if (await getResolutionForOrphanProcesses(orphanedProcesses)) {
      telemetryService.sendEventData(APEX_LSP_ORPHAN, undefined, {
        orphanCount: orphanedProcesses.length,
        didTerminate: 1
      });
      for (const processInfo of orphanedProcesses) {
        try {
          terminateProcess(processInfo.pid);
          telemetryService.sendEventData(APEX_LSP_ORPHAN, undefined, {
            terminateSuccessful: 1
          });
          showProcessTerminated(processInfo);
        } catch (err) {
          showTerminationFailed(processInfo, err);
          telemetryService.sendException(APEX_LSP_ORPHAN, typeof err === 'string' ? err : (err?.message ?? 'unknown'));
        }
      }
    } else {
      telemetryService.sendEventData(APEX_LSP_ORPHAN, undefined, {
        orphanCount: orphanedProcesses.length,
        didTerminate: 0
      });
    }
  }
};

/**
 * Ask the user how to resolve found orphaned language server instances
 * @param orphanedProcesses
 * @returns boolean
 */
const getResolutionForOrphanProcesses = async (orphanedProcesses: ProcessDetail[]): Promise<boolean> => {
  const orphanedCount = orphanedProcesses.length;

  if (orphanedCount === 0) {
    return false;
  }

  let choice: string | undefined;
  do {
    choice =
      (await vscode.window.showWarningMessage(
        nls.localize('terminate_orphaned_language_server_instances', orphanedCount),
        nls.localize('terminate_processes'),
        nls.localize('terminate_show_processes')
      )) ?? 'dismissed';

    if (requestsTermination(choice) && (await terminationConfirmation(orphanedCount))) {
      return true;
    } else if (showProcesses(choice)) {
      showOrphansInChannel(orphanedProcesses);
    }
  } while (!choice || showProcesses(choice));
  return false;
};

const showOrphansInChannel = (orphanedProcesses: ProcessDetail[]) => {
  const columns: Column[] = [
    { key: 'pid', label: nls.localize('process_id') },
    { key: 'ppid', label: nls.localize('parent_process_id') },
    { key: 'command', label: nls.localize('process_command') }
  ];

  const rows: Row[] = orphanedProcesses.map(processInfo => ({
    pid: processInfo.pid.toString(),
    ppid: processInfo.ppid.toString(),
    // split command into equal chunks no more than 70 characters long
    command:
      processInfo.command.length <= 70 ? processInfo.command : (processInfo.command.match(/.{1,70}/g)?.join('\n') ?? '')
  }));

  const tableString = createTable(rows, columns);

  channelService.showChannelOutput();
  channelService.appendLine(nls.localize('orphan_process_advice'));
  channelService.appendLine('');
  channelService.appendLine(tableString);
};

const terminationConfirmation = async (orphanedCount: number): Promise<boolean> => {
  const choice = await vscode.window.showWarningMessage(
    nls.localize('terminate_processes_confirm', orphanedCount),
    nls.localize('yes'),
    nls.localize('cancel')
  );
  return choice === nls.localize('yes');
};

const requestsTermination = (choice: string | undefined): boolean => choice === nls.localize('terminate_processes');

const showProcesses = (choice: string): boolean => choice === nls.localize('terminate_show_processes');

const showProcessTerminated = (processDetail: ProcessDetail): void => {
  channelService.appendLine(nls.localize('terminated_orphaned_process', processDetail.pid));
};

const showTerminationFailed = (processInfo: ProcessDetail, err: any): void => {
  channelService.appendLine(nls.localize('terminate_failed', processInfo.pid, err.message));
};

export const languageServerOrphanHandler = {
  getResolutionForOrphanProcesses,
  requestsTermination,
  resolveAnyFoundOrphanLanguageServers,
  showOrphansInChannel,
  showProcessTerminated,
  showProcesses,
  showTerminationFailed,
  terminationConfirmation
};
