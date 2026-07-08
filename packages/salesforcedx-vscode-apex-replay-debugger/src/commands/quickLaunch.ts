/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ApexTestResultData,
  LogService,
  ResultFormat,
  TestLevel,
  TestResult,
  TestService
} from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { projectPaths, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { checkpointService, sfCreateCheckpoints } from '../breakpoints/checkpointService';
import { nls } from '../messages';
import { ensureTraceFlagsForCurrentUser } from '../services/ensureTraceFlags';
import { getRuntime } from '../services/runtime';
import { retrieveTestCodeCoverage } from '../utils/settings';
import { launchFromLogFile } from './launchFromLogFile';

const debugTest = Effect.fn('ApexReplayDebugger.debugTest')(function* (testClass: string, testName?: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const connection = yield* api.services.ConnectionService.getConnection();

  if (!(yield* Effect.promise(() => ensureTraceFlagsForCurrentUser()))) return false;

  if (checkpointService.hasOneOrMoreActiveCheckpoints()) {
    if (!(yield* Effect.promise(() => sfCreateCheckpoints()))) return false;
  }

  const testService = new TestService(connection);
  const singleTestName = testName ? `${testClass}.${testName}` : undefined;
  const payload = yield* Effect.promise(() =>
    testService.buildSyncPayload(
      TestLevel.RunSpecifiedTests,
      singleTestName,
      singleTestName ? undefined : testClass,
      undefined,
      !retrieveTestCodeCoverage() // the setting enables code coverage, so we need to pass false to disable it
    )
  );
  // W-18453221
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const result: TestResult = (yield* Effect.promise(() => testService.runTestSynchronous(payload, true))) as TestResult;
  if (workspaceUtils.hasRootWorkspace()) {
    yield* Effect.promise(() =>
      testService.writeResultFiles(
        result,
        { dirPath: projectPaths.apexTestResultsFolder(), resultFormats: [ResultFormat.json] },
        retrieveTestCodeCoverage()
      )
    );
  }

  const tests: ApexTestResultData[] = result.tests;
  if (tests.length === 0) {
    void vscode.window.showErrorMessage(nls.localize('debug_test_no_results_found'));
    return false;
  }

  const testResult = testName ? (tests.find(test => test.methodName === testName) ?? tests[0]) : tests[0];
  if (!testResult?.apexLogId) {
    void vscode.window.showErrorMessage(nls.localize('debug_test_no_debug_log'));
    return false;
  }

  const logId = testResult.apexLogId!;
  const logService = new LogService(connection);
  yield* Effect.promise(() => logService.getLogs({ logId, outputDir: projectPaths.debugLogsFolder() }));
  yield* Effect.promise(() => launchFromLogFile(path.join(projectPaths.debugLogsFolder(), `${logId}.log`), false));
  return true;
});

export const setupAndDebugTests = async (className: string, methodName?: string): Promise<void> => {
  const success = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Running ${nls.localize('debug_test_exec_name')}`,
      cancellable: false
    },
    () =>
      getRuntime()
        .runPromise(debugTest(className, methodName))
        .catch((error: unknown) => {
          void vscode.window.showErrorMessage(nls.localize('debug_test_failed', String(error)));
        })
  );
  if (success) {
    void vscode.window.showInformationMessage(nls.localize('debug_test_success'));
  }
};
