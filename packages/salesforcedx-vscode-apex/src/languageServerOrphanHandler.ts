
import { Column, Row, Table } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from './channels';
import { APEX_LSP_ORPHAN } from './constants';
import { languageServerUtils as lsu, ProcessDetail } from './languageUtils';
import { nls } from './messages';
import { telemetryService } from './telemetry';

export const ADVICE = nls.localize('orphan_process_advice');
export const YES = nls.localize('yes');
export const CANCEL = nls.localize('cancel');
export const SHOW_PROCESSES = nls.localize('terminate_show_processes');
export const TERMINATE_PROCESSES_BTN = nls.localize('terminate_processes');
export const SHOW_PROCESSES_BTN = nls.localize('terminate_show_processes');
export const DISMISSED_DEFAULT = 'dismissed';
export const PROCESS_ID = nls.localize('process_id');
export const PROCESS_PARENT_ID = nls.localize('parent_process_id');
export const COMMAND = nls.localize('process_command');

// these messages contain replaceable parameters, cannot localize yet
export const CONFIRM = 'terminate_processes_confirm';
export const TERMINATE_ORPHANED_PROCESSES = 'terminate_orphaned_language_server_instances';
export const TERMINATED_PROCESS = 'terminated_orphaned_process';
export const TERMINATE_FAILED = 'terminate_failed';

async function resolveAnyFoundOrphanLanguageServers(): Promise<void> {
  const orphanedProcesses = lsu.findAndCheckOrphanedProcesses();
  if (orphanedProcesses.length > 0) {
    if (await getResolutionForOrphanProcesses(orphanedProcesses)) {
      telemetryService.sendEventData(APEX_LSP_ORPHAN, undefined, { orphanCount: orphanedProcesses.length, didTerminate: 1 });
      for (const processInfo of orphanedProcesses) {
        try {
          await lsu.terminateProcess(processInfo.pid);
          telemetryService.sendEventData(APEX_LSP_ORPHAN, undefined, { terminateSuccessful: 1 });
          showProcessTerminated(processInfo);
        } catch (err) {
          showTerminationFailed(processInfo, err);
          telemetryService.sendException(
            APEX_LSP_ORPHAN,
            typeof err === 'string' ? err : err?.message ? err.message : 'unknown');
        }
      }
    } else {
      telemetryService.sendEventData(APEX_LSP_ORPHAN, undefined, { orphanCount: orphanedProcesses.length, didTerminate: 0 });
    }
  }
}

/**
 * Ask the user how to resolve found orphaned language server instances
 * @param orphanedProcesses
 * @returns boolean
 */
async function getResolutionForOrphanProcesses(orphanedProcesses: ProcessDetail[]): Promise<boolean> {
  const orphanedCount = orphanedProcesses.length;

  if (orphanedCount === 0) {
    return false;
  }

  let choice: string | undefined;
  do {
    choice = await vscode.window.showWarningMessage(
      nls.localize(
        TERMINATE_ORPHANED_PROCESSES,
        orphanedCount
      ),
      TERMINATE_PROCESSES_BTN,
      SHOW_PROCESSES_BTN
    ) ?? DISMISSED_DEFAULT;

    if (requestsTermination(choice) && await terminationConfirmation(orphanedCount)) {
      return true;
    } else if (showProcesses(choice)) {
      showOrphansInChannel(orphanedProcesses);
    }
  } while (!choice || showProcesses(choice));
  return false;
}

function showOrphansInChannel(orphanedProcesses: ProcessDetail[]) {
  const columns: Column[] = [
    { key: 'pid', label: PROCESS_ID },
    { key: 'ppid', label: PROCESS_PARENT_ID },
    { key: 'command', label: COMMAND }
  ];

  const rows: Row[] = orphanedProcesses.map(processInfo => {
    return {
      pid: processInfo.pid.toString(),
      ppid: processInfo.ppid.toString(),
      // split command into equal chunks no more than 70 characters long
      command: processInfo.command.length <= 70 ? processInfo.command : processInfo.command.match(/.{1,70}/g)?.join('\n') ?? ''
    };
  });

  const table: Table = new Table();
  const tableString = table.createTable(rows, columns);

  channelService.showChannelOutput();
  channelService.appendLine(ADVICE);
  channelService.appendLine('');
  channelService.appendLine(tableString);
}

async function terminationConfirmation(orphanedCount: number): Promise<boolean> {
  const choice = await vscode.window.showWarningMessage(
    nls.localize(
      CONFIRM,
      orphanedCount
    ),
    YES,
    CANCEL
  );
  return choice === YES;
}

function requestsTermination(choice: string | undefined): boolean {
  return choice === TERMINATE_PROCESSES_BTN;
}

function showProcesses(choice: string): boolean {
  return choice === SHOW_PROCESSES_BTN;
}

function showProcessTerminated(processDetail: ProcessDetail): void {
  channelService.appendLine(nls.localize(TERMINATED_PROCESS, processDetail.pid));
}

function showTerminationFailed(processInfo: ProcessDetail, err: any): void {
  channelService.appendLine(nls.localize(TERMINATE_FAILED, processInfo.pid, err.message));
}

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
