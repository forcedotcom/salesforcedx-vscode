/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Column, Row, Table } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from './channels';
import { APEX_LSP_ORPHAN } from './constants';
import { findAndCheckOrphanedProcesses, terminateProcess, ProcessDetail } from './languageUtils';
import { nls } from './messages';
import { getTelemetryService } from './telemetry/telemetry';

const ADVICE = nls.localize('orphan_process_advice');
const YES = nls.localize('yes');
const CANCEL = nls.localize('cancel');
const TERMINATE_PROCESSES_BTN = nls.localize('terminate_processes');
const SHOW_PROCESSES_BTN = nls.localize('terminate_show_processes');
const DISMISSED_DEFAULT = 'dismissed';
const PROCESS_ID = nls.localize('process_id');
const PROCESS_PARENT_ID = nls.localize('parent_process_id');
const COMMAND = nls.localize('process_command');

// these messages contain replaceable parameters, cannot localize yet
const CONFIRM = 'terminate_processes_confirm';
const TERMINATE_ORPHANED_PROCESSES = 'terminate_orphaned_language_server_instances';
const TERMINATED_PROCESS = 'terminated_orphaned_process';
const TERMINATE_FAILED = 'terminate_failed';

const resolveAnyFoundOrphanLanguageServers = async (): Promise<void> => {
  const telemetryService = await getTelemetryService();
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
          telemetryService.sendException(
            APEX_LSP_ORPHAN,
            typeof err === 'string' ? err : err?.message ? err.message : 'unknown'
          );
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
        nls.localize(TERMINATE_ORPHANED_PROCESSES, orphanedCount),
        TERMINATE_PROCESSES_BTN,
        SHOW_PROCESSES_BTN
      )) ?? DISMISSED_DEFAULT;

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
    { key: 'pid', label: PROCESS_ID },
    { key: 'ppid', label: PROCESS_PARENT_ID },
    { key: 'command', label: COMMAND }
  ];

  const rows: Row[] = orphanedProcesses.map(processInfo => ({
    pid: processInfo.pid.toString(),
    ppid: processInfo.ppid.toString(),
    // split command into equal chunks no more than 70 characters long
    command:
      processInfo.command.length <= 70 ? processInfo.command : (processInfo.command.match(/.{1,70}/g)?.join('\n') ?? '')
  }));

  const table: Table = new Table();
  const tableString = table.createTable(rows, columns);

  channelService.showChannelOutput();
  channelService.appendLine(ADVICE);
  channelService.appendLine('');
  channelService.appendLine(tableString);
};

const terminationConfirmation = async (orphanedCount: number): Promise<boolean> => {
  const choice = await vscode.window.showWarningMessage(nls.localize(CONFIRM, orphanedCount), YES, CANCEL);
  return choice === YES;
};

const requestsTermination = (choice: string | undefined): boolean => choice === TERMINATE_PROCESSES_BTN;

const showProcesses = (choice: string): boolean => choice === SHOW_PROCESSES_BTN;

const showProcessTerminated = (processDetail: ProcessDetail): void => {
  channelService.appendLine(nls.localize(TERMINATED_PROCESS, processDetail.pid));
};

const showTerminationFailed = (processInfo: ProcessDetail, err: any): void => {
  channelService.appendLine(nls.localize(TERMINATE_FAILED, processInfo.pid, err.message));
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
