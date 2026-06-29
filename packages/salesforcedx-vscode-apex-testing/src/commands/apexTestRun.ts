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
import { nls } from '../messages';
import * as settings from '../settings';
import { discoverTests } from '../testDiscovery/testDiscovery';
import { ApexTestRunCacheService } from '../testRunCache/apexTestRunCacheService';
import { ApexTestQuickPickItem } from '../utils/fileHelpers';
import { notificationService } from '../utils/notificationHelpers';
import { getTestResultsFolder } from '../utils/pathHelpers';
import { getFullClassName, isFlowTest } from '../utils/toolingTestClassHelpers';
import { runApexTests } from './apexTestRunUtils';

/** Prompt the user to pick a test target (suite, class, or all). Fails with UserCancellationError on dismiss. */
const selectTests = Effect.fn('apexTestRun.selectTests')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  const buildItems = Effect.fn('apexTestRun.selectTests.buildItems')(function* () {
    const suiteAndClassItems = yield* Effect.all(
      {
        suiteItems: Effect.gen(function* () {
          const connection = yield* api.services.ConnectionService.getConnection();
          const suites = yield* Effect.promise(() => new TestService(connection).retrieveAllSuites());
          return suites.map(
            (suite): ApexTestQuickPickItem => ({
              label: suite.TestSuiteName,
              description: suite.id,
              type: 'Suite' as const
            })
          );
        }),
        classItems: discoverTests().pipe(
          Effect.map(discoveryResult =>
            discoveryResult.classes
              .filter(cls => !isFlowTest(cls) && (cls.testMethods?.length ?? 0) > 0)
              .map(
                (cls): ApexTestQuickPickItem => ({
                  label: cls.name,
                  description: cls.namespacePrefix ?? '',
                  type: 'Class' as const,
                  fullClassName: getFullClassName(cls)
                })
              )
          )
        )
      },
      { concurrency: 'unbounded' }
    ).pipe(
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

  return yield* buildItems().pipe(
    promptService.withCancellableProgress(nls.localize('retrieving_tests_message')),
    Effect.flatMap(items => Effect.promise(() => window.showQuickPick<ApexTestQuickPickItem>(items))),
    Effect.flatMap(selection => promptService.considerUndefinedAsCancellation(selection))
  );
});

/** Command entrypoint: pick a test target and run it. */
export const apexTestRun = Effect.fn('apexTestRun')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ProjectService.getSfProject();
  yield* runSelectedTests(yield* selectTests());
});

/** Shared helper: build the payload for a selected quick-pick item, run it with cancellable progress +
 * completion sentinel, and notify success/failure. Returns the TestResult, or undefined when the run
 * produced no usable result (e.g. timeout / no summary). User cancellation fails the fiber with
 * UserCancellationError rather than resolving to undefined.
 * Used by the run-tests command palette and the suite-run command. */
export const runSelectedTests = Effect.fn('runSelectedTests')(function* (selection: ApexTestQuickPickItem) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const channelService = yield* api.services.ChannelService;
  const executionName = nls.localize('apex_test_run_text');
  // e2e specs gate completion on the `Ended SFDX: …` channel sentinel
  const appendEnded = channelService.appendToChannel(`Ended ${executionName}`);

  const { payload, outputDir } = yield* Effect.all(
    {
      payload: api.services.ConnectionService.getConnection().pipe(
        Effect.flatMap(connection => Effect.promise(() => buildTestPayload(new TestService(connection), selection)))
      ),
      outputDir: getTestResultsFolder()
    },
    { concurrency: 'unbounded' }
  );

  if (selection.type === 'Class' && selection.fullClassName) {
    yield* ApexTestRunCacheService.setCachedClassTestParam(selection.fullClassName);
  }

  return yield* runApexTests({
    payload,
    outputDir,
    codeCoverage: settings.retrieveTestCodeCoverage(),
    concise: settings.retrieveTestRunConcise(),
    telemetryTrigger: 'quickPick'
  }).pipe(
    Effect.tapBoth({ onSuccess: () => appendEnded, onFailure: () => appendEnded }),
    promptService.withCancellableProgress(executionName),
    // Terminal notify on the success value (undefined = soft failure: timeout/no summary).
    // Cancellation stays on the failure channel, so this tap never fires a bogus toast.
    Effect.tap(result =>
      channelService.showChannel.pipe(
        Effect.andThen(
          Effect.sync(() =>
            (result === undefined
              ? notificationService.showFailedExecution
              : notificationService.showSuccessfulExecution)(executionName)
          )
        )
      )
    )
  );
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
