
import * as vscode from 'vscode';
import { channelService } from './channels';
import { ProcessDetail, findAndCheckOrphanedProcesses, terminateProcess } from './languageUtils';
import { nls } from './messages';
import { telemetryService } from './telemetry';

const ADVICE = nls.localize('orphan_process_advice');
const YES = nls.localize('yes');
const CANCEL = nls.localize('cancel');
const SHOW_PROCESSES = nls.localize('terminate_show_processes');
const TERMINATE_PROCESSES_BTN = nls.localize('terminate_processes')
const SHOW_PROCESSES_BTN = nls.localize('terminate_show_processes');
const DISMISSED_DEFAULT = nls.localize('dismissed');
const PROCESS_ID = nls.localize('process_id');
const PROCESS_PARENT_ID = nls.localize('parent_process_id');
const COMMAND = nls.localize('process_command');

// these messages contain replacable parameters, no cannot localize yet
const CONFIRM = 'terminate_processes_confirm'
const TERMINATE_ORPHANGED_PROCESSES = 'terminate_orphaned_language_server_instances';
const TERMINATED_PROCESS = 'terminated_orphaned_process';
const TERMINATE_FAILED = 'terminate_failed';

export async function resolveAnyFoundOrphanLanguageServers(): Promise<void> {
  const orphanedProcesses = findAndCheckOrphanedProcesses();
  if (orphanedProcesses.length > 0) {
    if (await getResolutionForOrphanProcesses(orphanedProcesses)) {
      telemetryService.sendEventData('apexLSPStartup', undefined, { orphanCount: orphanedProcesses.length, didTerminate: 1 });
      for (const processInfo of orphanedProcesses) {
        try {
          await terminateProcess(processInfo.pid);
          telemetryService.sendEventData('apexLSPStartup', undefined, { terminateSuccessful: 1 });
          showProcessTerminated(processInfo);
        } catch (err) {
          showTerminationFailed(processInfo, err);
          telemetryService.sendEventData(
            'apexLSPStartup',
            { terminationErrorMessage: typeof err === 'string' ? err : err?.message ? err.message : 'unknown' }, { terminateSuccessful: 0 });
        }
      }
    } else {
      telemetryService.sendEventData('apexLSPStartup', undefined, { orphanCount: orphanedProcesses.length, didTerminate: 0 });
    }
  }
}

/**
 * Ask the user how to resolve found orphaned language server instances
 * @param orphanedProcesses
 * @returns boolean
 */
export async function getResolutionForOrphanProcesses(orphanedProcesses: ProcessDetail[]): Promise<boolean> {
  const orphanedCount = orphanedProcesses.length;

  if (orphanedCount === 0) {
    return false;
  }

  let choice: string | undefined = nls.localize(SHOW_PROCESSES);
  do {
    choice = await vscode.window.showWarningMessage(
      nls.localize(
        TERMINATE_ORPHANGED_PROCESSES,
        orphanedCount
      ),
      TERMINATE_PROCESSES_BTN,
      SHOW_PROCESSES_BTN
    ) ?? DISMISSED_DEFAULT;

    if (requestsTermination(choice) && await terminationConfirmation(orphanedCount)) {
      return true;
    } else if (showProcesses(choice)) {
      const processId: string = PROCESS_ID;
      const parentProcessId: string = PROCESS_PARENT_ID;
      const processCommand: string = COMMAND;
      const title = `${processId} ${parentProcessId} ${processCommand}`;
      const titleUnderline = `${'='.repeat(processId.length)} ${'='.repeat(parentProcessId.length)} ${'='.repeat(processCommand.length)}`;
      const processList = orphanedProcesses.map(processInfo => {
        return `${processInfo.pid.toString().padStart(processId.length)} ${processInfo.ppid.toString().padStart(parentProcessId.length)} ${processInfo.command}`;
      });
      channelService.showChannelOutput();
      channelService.appendLine([ADVICE, '', title, titleUnderline, ...processList].join('\n'));
    }
  } while (!choice || showProcesses(choice));
  return false;
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

function showProcesses(choice: string) {
  return choice === SHOW_PROCESSES_BTN;
}

function showProcessTerminated(processDetal: ProcessDetail) {
  channelService.appendLine(nls.localize(TERMINATED_PROCESS, processDetal.pid));
}

function showTerminationFailed(processInfo: ProcessDetail, err: any) {
  channelService.appendLine(nls.localize(TERMINATE_FAILED, processInfo.pid, err.message));
}
