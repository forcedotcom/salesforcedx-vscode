/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type Column, createTable, ExtensionProviderService, type Row } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { channelService } from './channels';
import { APEX_LSP_ORPHAN, UBER_JAR_NAME } from './constants';
import { nls } from './messages';
import { getTelemetryService } from './telemetry/telemetry';

// these messages contain replaceable parameters, cannot localize yet

/** Internal-only error; never crosses the bundle boundary (not re-exported, handled via catchTag here). */
class ProcessTerminationError extends Schema.TaggedError<ProcessTerminationError>()('ProcessTerminationError', {
  pid: Schema.Number,
  message: Schema.String
}) {}

type ProcessDetail = {
  pid: number;
  ppid: number;
  command: string;
  orphaned: boolean;
};

const isWindows = process.platform === 'win32';

const listProcessesCmd = isWindows
  ? 'powershell.exe -command "Get-CimInstance -ClassName Win32_Process | ForEach-Object { [PSCustomObject]@{ ProcessId = $_.ProcessId; ParentProcessId = $_.ParentProcessId; CommandLine = $_.CommandLine } } | Format-Table -HideTableHeaders"'
  : 'ps -e -o pid,ppid,command';

const parentCheckCmd = (ppid: number): string =>
  isWindows
    ? `powershell.exe -command "Get-CimInstance -ClassName Win32_Process -Filter 'ProcessId = ${ppid}'"`
    : `ps -p ${ppid}`;

const parseProcessList = (stdout: string): ProcessDetail[] =>
  stdout
    .trim()
    .split(/\r?\n/g)
    .map(line => {
      const [pidStr, ppidStr, ...commandParts] = line.trim().split(/\s+/);
      return {
        pid: parseInt(pidStr, 10),
        ppid: parseInt(ppidStr, 10),
        command: commandParts.join(' '),
        orphaned: false
      };
    })
    .filter(processInfo => !['ps', 'grep', 'Get-CimInstance'].some(c => processInfo.command.includes(c)))
    .filter(processInfo => processInfo.command.includes(UBER_JAR_NAME));

/**
 * Find Apex Language Server processes whose parent no longer exists.
 * Replaces the former synchronous `execSync` implementation with async `TerminalService.simpleExec`
 * so it no longer blocks the extension host event loop on startup.
 */
const findOrphanedProcesses = Effect.fn('apex.orphan.findOrphaned')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const terminal = yield* api.services.TerminalService;
  const telemetryService = getTelemetryService();

  // Windows-only guard: powershell must be present. Preserves the prior no-powershell telemetry outcome.
  if (isWindows) {
    const hasPowershell = yield* terminal
      .simpleExec('where powershell', s => s)
      .pipe(
        Effect.map(stdout => stdout.trim().length > 0),
        Effect.catchTag('TerminalServiceError', e => {
          telemetryService.sendException('apex_lsp_orphan', e.message);
          return Effect.succeed(false);
        })
      );
    if (!hasPowershell) {
      return [];
    }
  }

  // Web (or any exec failure listing processes) → no orphan work.
  const candidates = yield* terminal
    .simpleExec(listProcessesCmd, s => s, 600_000)
    .pipe(
      Effect.map(parseProcessList),
      Effect.catchTag('TerminalServiceError', () => Effect.succeed<ProcessDetail[]>([]))
    );

  const checkParent = (processInfo: ProcessDetail): Effect.Effect<ProcessDetail> =>
    !isWindows && processInfo.ppid === 1
      ? Effect.succeed({ ...processInfo, orphaned: true })
      : terminal
          .simpleExec(parentCheckCmd(processInfo.ppid), s => s)
          .pipe(
            Effect.as(processInfo),
            Effect.catchTag('TerminalServiceError', e => {
              telemetryService.sendException('apex_lsp_orphan', e.message);
              return Effect.succeed({ ...processInfo, orphaned: true });
            })
          );

  const checked = yield* Effect.forEach(candidates, checkParent, { concurrency: 1 });
  return checked.filter(processInfo => processInfo.orphaned);
});

const killOne = (processInfo: ProcessDetail) =>
  Effect.try({
    try: () => process.kill(processInfo.pid, 'SIGKILL'),
    catch: e =>
      new ProcessTerminationError({
        pid: processInfo.pid,
        message: e instanceof Error ? e.message : 'unknown'
      })
  }).pipe(
    // bounded: 3 attempts total (initial + 2 retries); exponential alone would retry indefinitely
    Effect.retry(Schedule.exponential('2 seconds').pipe(Schedule.intersect(Schedule.recurs(2)))),
    Effect.tap(() => {
      getTelemetryService().sendEventData(APEX_LSP_ORPHAN, undefined, { terminateSuccessful: 1 });
      showProcessTerminated(processInfo);
      return Effect.void;
    }),
    Effect.catchTag('ProcessTerminationError', error => {
      showTerminationFailed(processInfo, error.message);
      getTelemetryService().sendException(APEX_LSP_ORPHAN, error.message);
      return Effect.void;
    })
  );

export const checkAndResolveOrphanedLanguageServers = Effect.fn('apex.orphan.checkAndResolve')(function* () {
  const telemetryService = getTelemetryService();
  const orphanedProcesses = yield* findOrphanedProcesses();
  yield* Effect.annotateCurrentSpan('orphanCount', orphanedProcesses.length);

  if (orphanedProcesses.length === 0) {
    return;
  }

  const shouldTerminate = yield* getResolutionForOrphanProcesses(orphanedProcesses).pipe(
    Effect.catchTag('UserCancellationError', () => Effect.succeed(false))
  );

  if (!shouldTerminate) {
    yield* Effect.annotateCurrentSpan('didTerminate', 0);
    telemetryService.sendEventData(APEX_LSP_ORPHAN, undefined, {
      orphanCount: orphanedProcesses.length,
      didTerminate: 0
    });
    return;
  }

  yield* Effect.annotateCurrentSpan('didTerminate', 1);
  telemetryService.sendEventData(APEX_LSP_ORPHAN, undefined, {
    orphanCount: orphanedProcesses.length,
    didTerminate: 1
  });

  yield* Effect.forEach(orphanedProcesses, killOne, { concurrency: 1 });
});

/** 'continue' = re-prompt (user asked to view the process table); boolean = terminal decision */
type Resolution = 'continue' | boolean;

/** Prompt once; returns 'continue' to re-prompt, or a terminal decision. Fails with UserCancellationError on dismissal. */
const promptOnce = Effect.fn('apex.orphan.promptOnce')(function* (orphanedProcesses: ProcessDetail[]) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const orphanedCount = orphanedProcesses.length;

  const choice = yield* Effect.promise(() =>
    vscode.window.showWarningMessage(
      nls.localize('terminate_orphaned_language_server_instances', orphanedCount),
      nls.localize('terminate_processes'),
      nls.localize('terminate_show_processes')
    )
  ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));

  if (requestsTermination(choice)) {
    const confirmed: Resolution = yield* terminationConfirmation(orphanedCount);
    return confirmed;
  }
  if (showProcesses(choice)) {
    showOrphansInChannel(orphanedProcesses);
    const keepGoing: Resolution = 'continue';
    return keepGoing;
  }
  const declined: Resolution = false;
  return declined;
});

/**
 * Ask the user how to resolve found orphaned language server instances.
 * Re-prompts while the user views the process table; fails with `UserCancellationError` on dismissal.
 */
const getResolutionForOrphanProcesses = Effect.fn('apex.orphan.getResolution')(function* (
  orphanedProcesses: ProcessDetail[]
) {
  const initial: Resolution = 'continue';
  const resolution = yield* Effect.iterate(initial, {
    while: state => state === 'continue',
    body: () => promptOnce(orphanedProcesses)
  });
  return resolution === true;
});

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

const terminationConfirmation = Effect.fn('apex.orphan.terminationConfirmation')(function* (orphanedCount: number) {
  const choice = yield* Effect.promise(() =>
    vscode.window.showWarningMessage(
      nls.localize('terminate_processes_confirm', orphanedCount),
      nls.localize('yes'),
      nls.localize('cancel')
    )
  );
  return choice === nls.localize('yes');
});

const requestsTermination = (choice: string): boolean => choice === nls.localize('terminate_processes');

const showProcesses = (choice: string): boolean => choice === nls.localize('terminate_show_processes');

const showProcessTerminated = (processDetail: ProcessDetail): void => {
  channelService.appendLine(nls.localize('terminated_orphaned_process', processDetail.pid));
};

const showTerminationFailed = (processInfo: ProcessDetail, message: string): void => {
  channelService.appendLine(nls.localize('terminate_failed', processInfo.pid, message));
};
