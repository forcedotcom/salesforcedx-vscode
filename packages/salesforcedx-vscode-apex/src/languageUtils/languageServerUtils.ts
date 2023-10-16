/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SIGKILL } from 'constants';
import * as crossSpawn from 'cross-spawn';
import * as os from 'os';
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

  let cmd: string;
  let params: string[];
  if (isWindows) {
    cmd = 'wmic';
    params = ['process', 'get', 'ProcessId,ParentProcessId,CommandLine'];
  } else {
    cmd = 'ps';
    params = ['-e', '-o', 'pid,ppid,command'];
  }

  const result = crossSpawn.sync(cmd, params);
  const lines: string[] = result.stdout.toString().trim().split(os.EOL);
  const processes: ProcessDetail[] = lines.map(line => {
    const [pidStr, ppidStr, ...commandParts] = line.trim().split(/\s+/);
    const pid = parseInt(pidStr, 10);
    const ppid = parseInt(ppidStr, 10);
    const command = commandParts.join(' ');
    return { pid, ppid, command, orphaned: false };
  })
    .filter(processInfo => processInfo.command.includes(UBER_JAR_NAME));

  if (processes.length === 0) {
    return [];
  }

  // Filter orphaned processes
  const orphanedProcesses: ProcessDetail[] = processes
    .map(processInfo => {
      if (!isWindows && processInfo.ppid === 1) {
        processInfo.orphaned = true;
        return processInfo;
      }
      if (isWindows) {
        cmd = 'wmic';
        params = ['process', 'where', `processid=${processInfo.ppid}`, 'get', 'processid'];
      } else {
        cmd = 'ps';
        params = ['-p', processes.map(p => p.ppid).join(','), '-o', 'pid'];
      }
      try {
        const checkResult = crossSpawn.sync(cmd, params);
        const checkLines: string[] = checkResult.stdout.toString().trim().split(os.EOL);
        if (isWindows) {
          if (checkLines.length === 1) {
            processInfo.orphaned = true;
          }
        }
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
