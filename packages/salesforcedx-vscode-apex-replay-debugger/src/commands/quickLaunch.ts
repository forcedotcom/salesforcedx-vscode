/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LogService, type TestResult, TestService } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { Context } from 'effect';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import type { NotificationModeService } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { checkpointService, sfCreateCheckpointsCommand } from '../breakpoints/checkpointService';
import { DEBUGGER_TYPE } from '../debuggerConstants';
import { nls } from '../messages';
import { ensureTraceFlagsForCurrentUser } from '../services/ensureTraceFlags';
import { getRuntime } from '../services/runtime';
import { type ProgressAndSuccessCommandKey } from '../utils/notificationMode';
import { retrieveTestCodeCoverage } from '../utils/settings';
import { launchFromLogFile } from './launchFromLogFile';

const COMMAND: ProgressAndSuccessCommandKey = 'Debug Apex Test Class';

/** Terminal toast for a debug batch: a "completed with failing tests" error when any test failed, otherwise
 * success. Shown after the replay debugger launches, which it does either way: a failing test is usually why
 * you're debugging it. */
export const showDebugTestOutcome = (
  notificationMode: Context.Tag.Service<typeof NotificationModeService>,
  failing: number
) =>
  failing > 0
    ? Effect.sync(
        () => void vscode.window.showErrorMessage(nls.localize('debug_test_completed_with_failures_message', failing))
      )
    : notificationMode.showSuccessNotification(COMMAND, nls.localize('debug_test_success'), false);

/** One synchronous test run: a whole class, or one method of it. */
type DebugTarget = { className: string; methodName?: string };

/** Parse a `Class.method` or `ns.Class.method` test name. */
const toMethodTarget = (name: string): DebugTarget => {
  const [methodName, className, namespace] = name.split('.').toReversed();
  return { className: namespace ? `${namespace}.${className}` : className, methodName };
};

/** A downloaded debug log, labelled with the test it came from for the replay progress message. */
type ReplayLog = { label: string; logPath: string };

const runSyncTests = Effect.fn('ApexReplayDebugger.runSyncTests')(function* (
  testService: TestService,
  { className, methodName }: DebugTarget,
  retrieveCodeCoverage: boolean,
  dirPath: string
) {
  const singleTestName = methodName ? `${className}.${methodName}` : undefined;
  const payload = yield* Effect.promise(() =>
    testService.buildSyncPayload(
      'RunSpecifiedTests',
      singleTestName,
      singleTestName ? undefined : className,
      undefined,
      !retrieveCodeCoverage // the setting enables code coverage, so we need to pass false to disable it
    )
  );
  // W-18453221
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const result: TestResult = (yield* Effect.promise(() => testService.runTestSynchronous(payload, true))) as TestResult;
  yield* Effect.promise(() =>
    testService.writeResultFiles(result, { dirPath, resultFormats: ['json'] }, retrieveCodeCoverage)
  );
  return { label: singleTestName ?? className, result };
});

const disposeAll = (disposables: readonly vscode.Disposable[]): void => {
  disposables.forEach(disposable => void disposable.dispose());
};

/** Resolve once no debug session is active (or `token` is cancelled). launchFromLogFile skips launching while a
 * session is active, and VS Code may still report the previous replay as active when its terminate event fires. */
const awaitNoActiveSession = (token: vscode.CancellationToken) =>
  Effect.async<void>(resume => {
    if (!vscode.debug.activeDebugSession || token.isCancellationRequested) {
      resume(Effect.void);
      return;
    }
    const listeners: vscode.Disposable[] = [];
    const settle = () => {
      disposeAll(listeners);
      resume(Effect.void);
    };
    listeners.push(
      vscode.debug.onDidChangeActiveDebugSession(session => {
        if (!session) settle();
      }),
      token.onCancellationRequested(settle)
    );
    return Effect.sync(() => disposeAll(listeners));
  });

/**
 * Start a replay session for `logPath` and resolve once it terminates, or right away when no session started.
 * Stops waiting when `token` is cancelled; the open session keeps running.
 */
const launchAndAwaitEnd = Effect.fn('ApexReplayDebugger.launchAndAwaitEnd')(function* (
  logPath: string,
  token: vscode.CancellationToken
) {
  const ended = yield* Deferred.make<void>();
  const end = () => Deferred.unsafeDone(ended, Exit.void);
  // Subscribe before launching: a log that hits no breakpoint can end its session immediately
  yield* Effect.acquireRelease(
    Effect.sync(() => [
      vscode.debug.onDidTerminateDebugSession(session => {
        if (session.type === DEBUGGER_TYPE) end();
      }),
      token.onCancellationRequested(end)
    ]),
    listeners => Effect.sync(() => disposeAll(listeners))
  );
  if (yield* launchFromLogFile(logPath, false)) {
    yield* Deferred.await(ended);
  }
}, Effect.scoped);

/**
 * Replay each log in turn, starting the next only when the previous session ends, so every selected test gets
 * debugged. Notification progress regardless of the user's mode: only a notification shows the Cancel button,
 * which stops before the next log.
 */
export const replayInOrder = (logs: readonly ReplayLog[]) =>
  Effect.promise(() =>
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: nls.localize('debug_test_replay_progress_title'),
        cancellable: true
      },
      (progress, token) =>
        Effect.runPromise(
          Effect.forEach(
            logs,
            ({ label, logPath }, index) =>
              token.isCancellationRequested
                ? Effect.void
                : Effect.sync(() =>
                    progress.report({
                      message: nls.localize('debug_test_replay_progress_message', index + 1, logs.length, label)
                    })
                  ).pipe(
                    Effect.andThen(awaitNoActiveSession(token)),
                    Effect.andThen(
                      Effect.suspend(() =>
                        token.isCancellationRequested ? Effect.void : launchAndAwaitEnd(logPath, token)
                      )
                    )
                  ),
            { concurrency: 1, discard: true }
          )
        )
    )
  ).pipe(
    Effect.catchAllDefect(defect =>
      Effect.sync(() => void vscode.window.showErrorMessage(nls.localize('debug_test_failed', String(defect))))
    )
  );

/** Run every target, show one notification for the whole batch, then replay each run's log. */
const debugTests = Effect.fn('ApexReplayDebugger.debugTests')(function* (targets: readonly DebugTarget[]) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const notificationMode = yield* api.services.NotificationModeService;
  // ProjectService's folders (test results, debug logs) need an open workspace, so there's nothing to do
  // without one
  const { isEmpty } = yield* api.services.WorkspaceService.getWorkspaceInfo();
  if (isEmpty) return false;
  const connection = yield* api.services.ConnectionService.getConnection();

  if (!(yield* ensureTraceFlagsForCurrentUser())) return false;

  if (checkpointService.hasOneOrMoreActiveCheckpoints()) {
    if (!(yield* sfCreateCheckpointsCommand())) return false;
  }

  const testService = new TestService(connection);
  const retrieveCodeCoverage = yield* retrieveTestCodeCoverage();
  const dirPath = (yield* api.services.ProjectService.getApexTestResultsFolder()).fsPath;
  // A synchronous run takes a single class, so a multi-class selection runs one target at a time
  const syncRuns = yield* Effect.forEach(
    targets,
    target => runSyncTests(testService, target, retrieveCodeCoverage, dirPath),
    { concurrency: 1 }
  );

  const runsWithResults = syncRuns.filter(({ result }) => result.tests.length > 0);
  if (runsWithResults.length === 0) {
    void vscode.window.showErrorMessage(nls.localize('debug_test_no_results_found'));
    return false;
  }
  // A synchronous run writes one log, shared by every test in it
  const runsWithLogs = runsWithResults.flatMap(({ label, result }) => {
    const logId = result.tests[0].apexLogId;
    return logId ? [{ label, logId }] : [];
  });
  if (runsWithLogs.length === 0) {
    void vscode.window.showErrorMessage(nls.localize('debug_test_no_debug_log'));
    return false;
  }

  const logService = new LogService(connection);
  const debugLogsFolder = yield* api.services.ProjectService.getDebugLogsFolder();
  const replayLogs: ReplayLog[] = yield* Effect.forEach(
    runsWithLogs,
    ({ label, logId }) =>
      Effect.promise(() => logService.getLogs({ logId, outputDir: debugLogsFolder.fsPath })).pipe(
        Effect.as({ label, logPath: Utils.joinPath(debugLogsFolder, `${logId}.log`).fsPath })
      ),
    { concurrency: 'unbounded' }
  );

  // One log replays as before. Several replay in the background so the progress and the Test Explorer run end
  // now, while the user steps through each session.
  if (replayLogs.length === 1) {
    yield* launchFromLogFile(replayLogs[0].logPath, false);
  } else {
    yield* Effect.forkDaemon(replayInOrder(replayLogs));
  }
  yield* showDebugTestOutcome(
    notificationMode,
    syncRuns.reduce((failing, { result }) => failing + result.summary.failing, 0)
  );
  return true;
});

const setupAndDebugTests = async (targets: readonly DebugTarget[]): Promise<void> => {
  const progressLocation = await getRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const notificationMode = yield* api.services.NotificationModeService;
      return yield* notificationMode.getProgressLocation(COMMAND);
    })
  );
  try {
    await vscode.window.withProgress(
      {
        location: progressLocation,
        title: `Running ${nls.localize('debug_test_exec_name')}`,
        cancellable: false
      },
      () => getRuntime().runPromise(debugTests(targets))
    );
  } catch (error) {
    void vscode.window.showErrorMessage(nls.localize('debug_test_failed', String(error)));
  }
};

/**
 * `{ name }`: one class (code lens, Launch Apex Replay Debugger with Current File).
 * `{ classNames, methodNames }`: a Test Explorer selection, debugged as one batch with one notification.
 * `methodNames` take the `Class.method` / `ns.Class.method` form that `sf.test.view.debugSingleTest` takes.
 */
export type DebugTestsArg = { name: string } | { classNames: readonly string[]; methodNames: readonly string[] };

export const debugTestsCommand = Effect.fn('debugTestsCommand')(function* (arg: DebugTestsArg) {
  const targets =
    'name' in arg
      ? [{ className: arg.name }]
      : [...arg.classNames.map(className => ({ className })), ...arg.methodNames.map(toMethodTarget)];
  yield* Effect.promise(() => setupAndDebugTests(targets));
});

export const debugSingleTestCommand = Effect.fn('debugSingleTestCommand')(function* (test: { name: string }) {
  yield* Effect.promise(() => setupAndDebugTests([toMethodTarget(test.name)]));
});
