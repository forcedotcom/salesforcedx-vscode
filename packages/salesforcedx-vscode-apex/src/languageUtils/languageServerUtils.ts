/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execSync } from 'child_process';
import { SIGKILL } from 'constants';
import { UBER_JAR_NAME } from '../constants';

export type ProcessDetail = {
  pid: number;
  ppid: number;
  command: string;
  orphaned: boolean;
};

export function findAndCheckOrphanedProcesses(): ProcessDetail[] {
  const platform = process.platform.toLowerCase();
  const isWindows = platform === 'win32';

  const cmd = isWindows
    ? `Get-CimInstance -ClassName Win32_Process | Where-Object { $_.CommandLine -like '*${UBER_JAR_NAME}*' } | ForEach-Object { [PSCustomObject]@{ ProcessId = $_.ProcessId; ParentProcessId = $_.ParentProcessId; CommandLine = $_.CommandLine } } | Format-Table -HideTableHeaders`
    : `ps -e -o pid,ppid,command | grep "${UBER_JAR_NAME}"`;

  const stdout = execSync(
    isWindows ? `powershell.exe -command "${cmd}"` : cmd
  ).toString();
  const lines = stdout.trim().split('\n');
  const processes: ProcessDetail[] = lines.map(line => {
    const [pidStr, ppidStr, ...commandParts] = line.trim().split(/\s+/);
    const pid = parseInt(pidStr, 10);
    const ppid = parseInt(ppidStr, 10);
    const command = commandParts.join(' ');
    return { pid, ppid, command, orphaned: false };
  });

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
        processInfo.orphaned = true;
      }
      return processInfo;
    })
    .filter(processInfo => processInfo.orphaned);

  return orphanedProcesses;
}

export async function terminateProcess(pid: number) {
  process.kill(pid, SIGKILL);
}
