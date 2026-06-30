/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  annotateRootSpan,
  type Column,
  createTable,
  ExtensionProviderService,
  type Row
} from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { channelService } from './channels';
import { UBER_JAR_NAME } from './constants';
import { nls } from './messages';

// these messages contain replaceable parameters, cannot localize yet

/** Internal-only; handled via catchTag here. */
class ProcessTerminationError extends Schema.TaggedError<ProcessTerminationError>()('ProcessTerminationError', {
  pid: Schema.Number,
  message: Schema.String
}) {}

const ProcessDetailSchema = Schema.Struct({
  pid: Schema.Number,
  ppid: Schema.Number,
  command: Schema.String,
  orphaned: Schema.Boolean
});

type ProcessDetail = typeof ProcessDetailSchema.Type;

const isWindows = process.platform === 'win32';

const listProcessesCmd = isWindows
  ? 'powershell.exe -command "Get-CimInstance -ClassName Win32_Process | ForEach-Object { [PSCustomObject]@{ ProcessId = $_.ProcessId; ParentProcessId = $_.ParentProcessId; CommandLine = $_.CommandLine } } | Format-Table -HideTableHeaders"'
  : 'ps -e -o pid,ppid,command';

const parentCheckCmd = (ppid: number): string =>
  isWindows
    ? `powershell.exe -command "Get-CimInstance -ClassName Win32_Process -Filter 'ProcessId = ${ppid}'"`
    : `ps -p ${ppid}`;

const decodeProcessList = Schema.decodeSync(Schema.mutable(Schema.Array(ProcessDetailSchema)));

// stdout already trimmed by simpleExec
const parseProcessList = (stdout: string): ProcessDetail[] =>
  decodeProcessList(
    stdout
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
      .filter(processInfo => processInfo.command.includes(UBER_JAR_NAME))
  );

/** Find Apex Language Server processes whose parent no longer exists. */
const findOrphanedProcesses = Effect.fn('apex.orphan.findOrphaned')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const terminal = yield* api.services.TerminalService;

  // Windows-only guard: powershell must be present to list processes.
  if (isWindows) {
    const hasPowershell = yield* terminal
      .simpleExec({ command: 'where powershell', parse: stdout => stdout.length > 0 })
      .pipe(
        Effect.catchTag('TerminalServiceError', e =>
          annotateRootSpan('orphanCheckError', e.message).pipe(Effect.as(false))
        )
      );
    if (!hasPowershell) {
      return [];
    }
  }

  // Web (or any exec failure listing processes) → no orphan work.
  const candidates = yield* terminal
    .simpleExec({ command: listProcessesCmd, parse: parseProcessList, timeout: 60_000 })
    .pipe(Effect.catchTag('TerminalServiceError', () => Effect.succeed<ProcessDetail[]>([])));

  const checkParent = (processInfo: ProcessDetail): Effect.Effect<ProcessDetail> =>
    !isWindows && processInfo.ppid === 1
      ? Effect.succeed({ ...processInfo, orphaned: true })
      : terminal.simpleExec({ command: parentCheckCmd(processInfo.ppid), parse: s => s }).pipe(
          Effect.as(processInfo),
          Effect.catchTag('TerminalServiceError', e =>
            annotateRootSpan('orphanCheckError', e.message).pipe(Effect.as({ ...processInfo, orphaned: true }))
          )
        );

  return (yield* Effect.forEach(candidates, checkParent, { concurrency: 1 })).filter(
    processInfo => processInfo.orphaned
  );
});

const killOne = Effect.fn('apex.orphan.killOne')(function* (processInfo: ProcessDetail) {
  yield* Effect.try({
    try: () => process.kill(processInfo.pid, 'SIGKILL'),
    catch: e =>
      new ProcessTerminationError({
        pid: processInfo.pid,
        message: e instanceof Error ? e.message : 'unknown'
      })
  }).pipe(
    Effect.retry(Schedule.exponential('2 seconds').pipe(Schedule.intersect(Schedule.recurs(2)))),
    Effect.withSpan('apex.orphan.killOne.succeeded', { attributes: { pid: processInfo.pid } }),
    Effect.tap(() => {
      showProcessTerminated(processInfo);
      return Effect.void;
    }),
    Effect.catchTag('ProcessTerminationError', error => {
      showTerminationFailed(processInfo, error.message);
      return annotateRootSpan('orphanKillError', error.message);
    })
  );
});

export const checkAndResolveOrphanedLanguageServers = Effect.fn('apex.orphan.checkAndResolve')(function* () {
  // Services extension unavailable → can't check; record on root span, treat as no orphans.
  const orphanedProcesses = yield* findOrphanedProcesses().pipe(
    Effect.catchTags({
      ServicesExtensionNotFoundError: e =>
        annotateRootSpan('orphanCheckError', String(e)).pipe(Effect.as<ProcessDetail[]>([])),
      InvalidServicesApiError: e =>
        annotateRootSpan('orphanCheckError', e.cause?.message ?? String(e)).pipe(Effect.as<ProcessDetail[]>([]))
    })
  );
  yield* annotateRootSpan('orphanCount', orphanedProcesses.length);

  if (orphanedProcesses.length === 0) {
    return;
  }

  // When auto-terminate is enabled, silently kill orphans without prompting.
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const settings = yield* api.services.SettingsService;
  const autoTerminate = yield* settings
    .getValue<boolean>('salesforcedx-vscode-apex', 'autoTerminateOrphanedProcesses', false)
    .pipe(
      Effect.map(v => v === true),
      Effect.catchTag('MissingSettingsError', () => Effect.succeed(false))
    );

  if (autoTerminate) {
    yield* annotateRootSpan('didTerminate', 1);
    yield* Effect.forEach(orphanedProcesses, killOne, { concurrency: 1 });
    return;
  }

  const shouldTerminate = yield* getResolutionForOrphanProcesses(orphanedProcesses).pipe(
    Effect.catchTag('UserCancellationError', () => Effect.succeed(false))
  );

  yield* annotateRootSpan('didTerminate', shouldTerminate ? 1 : 0);

  if (!shouldTerminate) {
    return;
  }

  yield* Effect.forEach(orphanedProcesses, killOne, { concurrency: 1 });
});

/** 'continue' = re-prompt (user asked to view the process table); boolean = terminal decision */
type Resolution = 'continue' | boolean;

/** Prompt once. Fails with UserCancellationError on dismissal. */
const promptOnce = Effect.fn('apex.orphan.promptOnce')(function* (orphanedProcesses: ProcessDetail[]) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const orphanedCount = orphanedProcesses.length;

  const choice = yield* Effect.promise(() =>
    vscode.window.showWarningMessage(
      nls.localize('terminate_orphaned_language_server_instances', orphanedCount),
      nls.localize('terminate_processes'),
      nls.localize('terminate_show_processes'),
      nls.localize('always_auto_terminate')
    )
  ).pipe(Effect.flatMap((yield* api.services.PromptService).considerUndefinedAsCancellation));

  if (requestsTermination(choice)) {
    return yield* terminationConfirmation(orphanedCount);
  }
  if (showProcesses(choice)) {
    showOrphansInChannel(orphanedProcesses);
    return 'continue';
  }
  if (requestsAlwaysAutoTerminate(choice)) {
    return yield* alwaysAutoTerminateConfirmation();
  }
  return false;
});

/**
 * Ask the user how to resolve found orphaned language server instances.
 * Re-prompts while the user views the process table; fails with `UserCancellationError` on dismissal.
 */
const getResolutionForOrphanProcesses = Effect.fn('apex.orphan.getResolution')(function* (
  orphanedProcesses: ProcessDetail[]
) {
  const initialState: Resolution = 'continue';
  return (
    (yield* Effect.iterate(initialState, {
      while: state => state === 'continue',
      body: () => promptOnce(orphanedProcesses)
    })) === true
  );
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
    // modal: VS Code adds Cancel automatically; blocks until the user makes a destructive-action decision
    vscode.window.showWarningMessage(
      nls.localize('terminate_processes_confirm', orphanedCount),
      { modal: true },
      nls.localize('yes')
    )
  );
  return choice === nls.localize('yes');
});

const requestsTermination = (choice: string): boolean => choice === nls.localize('terminate_processes');

const showProcesses = (choice: string): boolean => choice === nls.localize('terminate_show_processes');

const requestsAlwaysAutoTerminate = (choice: string): boolean => choice === nls.localize('always_auto_terminate');

/** Show modal confirming auto-terminate; on Confirm persist setting + return true (kill). */
const alwaysAutoTerminateConfirmation = Effect.fn('apex.orphan.alwaysAutoTerminateConfirmation')(function* () {
  const choice = yield* Effect.promise(() =>
    vscode.window.showWarningMessage(
      nls.localize('always_auto_terminate'),
      { modal: true, detail: nls.localize('auto_terminate_confirm_modal') },
      nls.localize('confirm')
    )
  );
  if (choice !== nls.localize('confirm')) {
    return false;
  }
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const settings = yield* api.services.SettingsService;
  yield* settings
    .setValue('salesforcedx-vscode-apex', 'autoTerminateOrphanedProcesses', true)
    .pipe(Effect.catchTag('MissingSettingsError', e => annotateRootSpan('settingsWriteError', e.message)));
  return true;
});

const showProcessTerminated = (processDetail: ProcessDetail): void => {
  channelService.appendLine(nls.localize('terminated_orphaned_process', processDetail.pid));
};

const showTerminationFailed = (processInfo: ProcessDetail, message: string): void => {
  channelService.appendLine(nls.localize('terminate_failed', processInfo.pid, message));
};
