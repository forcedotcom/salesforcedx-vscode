/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AsyncTestConfiguration, TestLevel, TestService } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { window } from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { getConnection } from '../coreExtensionUtils';
import { nls } from '../messages';
import * as settings from '../settings';
import { discoverTests } from '../testDiscovery/testDiscovery';
import { withExecutionLog } from '../utils/executionLog';
import { ApexTestQuickPickItem } from '../utils/fileHelpers';
import { notificationService } from '../utils/notificationHelpers';
import { getTestResultsFolder } from '../utils/pathHelpers';
import { ensureSalesforceProject } from '../utils/projectPrecheck';
import { getFullClassName, isFlowTest } from '../utils/testUtils';
import { runApexTests } from './apexTestRunUtils';

/** Prompt the user to pick a test target (suite, class, or all). Fails with UserCancellationError on dismiss. */
const selectTests = Effect.fn('apexTestRun.selectTests')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  const buildItems = Effect.fn('apexTestRun.selectTests.buildItems')(function* () {
    const suiteAndClassItems = yield* Effect.gen(function* () {
      const connection = yield* Effect.promise(() => getConnection());
      const testService = new TestService(connection);
      const suites = yield* Effect.promise(() => testService.retrieveAllSuites());
      const discoveryResult = yield* discoverTests();
      const suiteItems = suites.map(
        (suite): ApexTestQuickPickItem => ({
          label: suite.TestSuiteName,
          description: suite.id,
          type: 'Suite' as const
        })
      );
      const classItems = discoveryResult.classes
        .filter(cls => !isFlowTest(cls) && (cls.testMethods?.length ?? 0) > 0)
        .map(
          (cls): ApexTestQuickPickItem => ({
            label: cls.name,
            description: cls.namespacePrefix ?? '',
            type: 'Class' as const,
            fullClassName: getFullClassName(cls)
          })
        );
      return { suiteItems, classItems };
    }).pipe(
      // No org or discovery failed; quick pick will only show All/AllLocal
      Effect.catchAll(() => Effect.succeed({ suiteItems: [], classItems: [] }))
    );

    return [
      ...suiteAndClassItems.suiteItems,
      {
        label: nls.localize('apex_test_run_all_local_test_label'),
        description: nls.localize('apex_test_run_all_local_tests_description_text'),
        type: 'AllLocal' as const
      },
      {
        label: nls.localize('apex_test_run_all_test_label'),
        description: nls.localize('apex_test_run_all_tests_description_text'),
        type: 'All' as const
      },
      ...suiteAndClassItems.classItems
    ];
  });

  const items = yield* buildItems().pipe(
    promptService.withCancellableProgress(nls.localize('retrieving_tests_message'))
  );

  const selection = yield* Effect.promise(() => window.showQuickPick<ApexTestQuickPickItem>(items));
  return yield* promptService.considerUndefinedAsCancellation(selection);
});

/** Command entrypoint: pick a test target and run it. */
export const apexTestRun = Effect.fn('apexTestRun')(function* () {
  yield* ensureSalesforceProject();
  const selection = yield* selectTests();
  yield* runSelectedTests(selection);
});

/** Shared helper: build the payload for a selected quick-pick item, run it with cancellable progress +
 * completion sentinel, and notify success/failure. Returns the TestResult or undefined if cancelled.
 * Used by the run-tests command palette and the suite-run command. */
export const runSelectedTests = Effect.fn('runSelectedTests')(function* (selection: ApexTestQuickPickItem) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  const connection = yield* Effect.promise(() => getConnection());
  const testService = new TestService(connection);
  const payload = yield* Effect.promise(() => buildTestPayload(testService, selection));
  const outputDir = yield* Effect.promise(() => getTestResultsFolder());

  const result = yield* runApexTests({
    payload,
    outputDir,
    codeCoverage: settings.retrieveTestCodeCoverage(),
    concise: settings.retrieveTestRunConcise(),
    telemetryTrigger: 'quickPick'
  }).pipe(
    withExecutionLog(nls.localize('apex_test_run_text')),
    promptService.withCancellableProgress(nls.localize('apex_test_run_text'))
  );

  OUTPUT_CHANNEL.show();
  if (result === undefined) {
    notificationService.showFailedExecution(nls.localize('apex_test_run_text'));
  } else {
    notificationService.showSuccessfulExecution(nls.localize('apex_test_run_text'));
  }
  return result;
});

const buildTestPayload = async (
  testService: TestService,
  data: ApexTestQuickPickItem
): Promise<AsyncTestConfiguration> => {
  const testLevel = TestLevel.RunSpecifiedTests;
  switch (data.type) {
    case 'Class':
      return await testService.buildAsyncPayload(
        testLevel,
        undefined,
        data.fullClassName,
        undefined,
        undefined,
        !settings.retrieveTestCodeCoverage() // the setting enables code coverage, so we need to pass false to disable it
      );
    case 'Suite':
      return await testService.buildAsyncPayload(
        testLevel,
        undefined,
        undefined,
        data.label,
        undefined,
        !settings.retrieveTestCodeCoverage()
      );
    case 'AllLocal':
      return { testLevel: TestLevel.RunLocalTests };
    case 'All':
      return { testLevel: TestLevel.RunAllTestsInOrg };
    default:
      return { testLevel: TestLevel.RunAllTestsInOrg };
  }
};
