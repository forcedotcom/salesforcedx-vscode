/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execSync } from 'child_process';
import { SIGKILL } from 'constants';
import { APEX_LSP_ORPHAN, POWERSHELL_NOT_FOUND, UBER_JAR_NAME } from '../constants';
import { getTelemetryService } from '../telemetry/telemetry';

export type ProcessDetail = {
  pid: number;
  ppid: number;
  command: string;
  orphaned: boolean;
};

const findAndCheckOrphanedProcesses = async (): Promise<ProcessDetail[]> => {
  const telemetryService = await getTelemetryService();
  const platform = process.platform.toLowerCase();
  const isWindows = platform === 'win32';

  // check if able to check processes
  if (!languageServerUtils.canRunCheck(isWindows)) {
    return [];
  }

  const cmd = isWindows
    ? 'powershell.exe -command "Get-CimInstance -ClassName Win32_Process | ForEach-Object { [PSCustomObject]@{ ProcessId = $_.ProcessId; ParentProcessId = $_.ParentProcessId; CommandLine = $_.CommandLine } } | Format-Table -HideTableHeaders"'
    : 'ps -e -o pid,ppid,command';

  const stdout = execSync(cmd).toString();
  const lines = stdout.trim().split(/\r?\n/g);
  const processes: ProcessDetail[] = lines
    .map(line => {
      const [pidStr, ppidStr, ...commandParts] = line.trim().split(/\s+/);
      const pid = parseInt(pidStr, 10);
      const ppid = parseInt(ppidStr, 10);
      const command = commandParts.join(' ');
      return { pid, ppid, command, orphaned: false };
    })
    .filter(processInfo => !['ps', 'grep', 'Get-CimInstance'].some(c => processInfo.command.includes(c)))
    .filter(processInfo => processInfo.command.includes(UBER_JAR_NAME));

  if (processes.length === 0) {
    return [];
  }

  // Filter orphaned processes
  const orphanedProcesses: ProcessDetail[] = processes
    .map(processInfo => {
      const checkOrphanedCmd = isWindows
        ? `powershell.exe -command "Get-CimInstance -ClassName Win32_Process -Filter 'ProcessId = ${processInfo.ppid}'"`
        : `ps -p ${processInfo.ppid}`;
      // a parent pid of 1 on posix means jorje was adopted by system process 1, which is always running.
      if (!isWindows && processInfo.ppid === 1) {
        processInfo.orphaned = true;
        return processInfo;
      }
      try {
        execSync(checkOrphanedCmd);
      } catch (err) {
        telemetryService.sendException(
          APEX_LSP_ORPHAN,
          typeof err === 'string' ? err : err?.message ? err.message : 'unknown'
        );
        processInfo.orphaned = true;
      }
      return processInfo;
    })
    .filter(processInfo => processInfo.orphaned);
  return orphanedProcesses;
};

const terminateProcess = (pid: number) => {
  process.kill(pid, SIGKILL);
};

const canRunCheck = async (isWindows: boolean) => {
  const telemetryService = await getTelemetryService();
  if (isWindows) {
    try {
      // where command will return path if found and empty string if not
      const wherePowershell = execSync('where powershell');
      if (wherePowershell.toString().trim().length === 0) {
        telemetryService.sendException(APEX_LSP_ORPHAN, POWERSHELL_NOT_FOUND);
        return false;
      }
      return true;
    } catch (err) {
      telemetryService.sendException(
        APEX_LSP_ORPHAN,
        typeof err === 'string' ? err : err?.message ? err.message : 'unknown'
      );
      return false;
    }
  }
  return true;
};

export const languageServerUtils = {
  findAndCheckOrphanedProcesses,
  terminateProcess,
  canRunCheck
};
