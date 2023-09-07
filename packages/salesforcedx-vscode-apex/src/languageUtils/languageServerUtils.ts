/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execSync } from 'child_process';
import { SIGKILL } from 'constants';
import { setTimeout } from 'timers';
import * as vscode from 'vscode';
import { UBER_JAR_NAME } from '../languageServer';
import { nls } from '../messages';

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
        ? `powershell.exe -command "Get-CimInstance -ClassName Win32_Process -Filter 'ProcessId = ${process.pid}'"`
        : `ps -p ${process.pid}`;
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

export async function showOrphanedProcessesDialog(
  orphanedProcesses: ProcessDetail[]
) {
  const orphanedCount = orphanedProcesses.length;

  if (orphanedCount === 0) {
    return;
  }

  setTimeout(async () => {
    const choice = await vscode.window.showWarningMessage(
      nls.localize(
        'terminate_orphaned_language_server_instances',
        orphanedCount
      ),
      nls.localize('terminate_processes'),
      nls.localize('terminate_skip')
    );

    if (choice === nls.localize('terminate_processes')) {
      for (const processInfo of orphanedProcesses) {
        await terminateProcess(processInfo.pid);
      }
      vscode.window.showInformationMessage(
        `Terminated ${orphanedCount} orphaned processes.`
      );
    }
  }, 10_000);
}

export async function terminateProcess(pid: number) {
  const platform = process.platform.toLowerCase();

  try {
    process.kill(pid, SIGKILL);
  } catch (err) {
    vscode.window.showErrorMessage(
      `Failed to terminate process ${pid}: ${err.message}`
    );
  }
}
