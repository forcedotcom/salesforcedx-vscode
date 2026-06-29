/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestService } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { nls } from '../messages';
import { MessageKey } from '../messages/i18n';
import { discoverTests } from '../testDiscovery/testDiscovery';
import { ApexTestQuickPickItem } from '../utils/fileHelpers';
import { notificationService } from '../utils/notificationHelpers';
import { getFullClassName, isFlowTest } from '../utils/toolingTestClassHelpers';
import { getTestController } from '../views/testController';
import { runSelectedTests } from './apexTestRun';

type ApexTestSuiteOptions = { suitename: string; tests: string[] };

const listApexClassItems = Effect.fn('apexTestSuite.listApexClassItems')(function* () {
  const result = yield* discoverTests();
  return result.classes
    .filter(cls => !isFlowTest(cls))
    .map(
      (cls): ApexTestQuickPickItem => ({
        label: cls.name,
        description: cls.namespacePrefix ?? '',
        type: 'Class',
        fullClassName: getFullClassName(cls)
      })
    )
    .toSorted((a, b): number => {
      const byLabel = a.label.localeCompare(b.label);
      return byLabel !== 0 ? byLabel : (a.fullClassName ?? '').localeCompare(b.fullClassName ?? '');
    });
});

const listApexTestSuiteItems = Effect.fn('apexTestSuite.listApexTestSuiteItems')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const connection = yield* api.services.ConnectionService.getConnection();
  const suites = yield* Effect.promise(() => new TestService(connection).retrieveAllSuites());
  return suites.map(
    (testSuite): ApexTestQuickPickItem => ({
      label: testSuite.TestSuiteName,
      description: testSuite.id,
      type: 'Suite'
    })
  );
});

/** Prompt for the apex classes to include in a suite. Fails with UserCancellationError on dismiss/empty. */
const selectApexClasses = Effect.fn('apexTestSuite.selectApexClasses')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  const apexClassItems = yield* listApexClassItems().pipe(
    promptService.withCancellableProgress(nls.localize('retrieving_tests_message'))
  );

  const selection = yield* Effect.promise(() =>
    vscode.window.showQuickPick<ApexTestQuickPickItem>(apexClassItems, { canPickMany: true })
  );
  // considerUndefinedAsCancellation does not handle empty arrays, so guard explicitly
  if (!selection || selection.length === 0) {
    return yield* new api.services.UserCancellationError();
  }
  return selection.map(item => item.fullClassName ?? item.label);
});

/** Gather suite options for adding tests to an existing suite. */
const gatherAddOptions = Effect.fn('apexTestSuite.gatherAddOptions')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  const quickPickItems = yield* listApexTestSuiteItems();
  const testSuite = yield* Effect.promise(() =>
    vscode.window.showQuickPick<ApexTestQuickPickItem>(quickPickItems)
  ).pipe(Effect.flatMap(value => promptService.considerUndefinedAsCancellation(value)));
  const tests = yield* selectApexClasses();
  return { suitename: testSuite.label, tests };
});

/** Gather suite options for creating a new suite. */
const gatherCreateOptions = Effect.fn('apexTestSuite.gatherCreateOptions')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  const suitename = yield* Effect.promise(() =>
    vscode.window.showInputBox({ prompt: nls.localize('apex_test_suite_name_input_prompt') })
  ).pipe(Effect.flatMap(value => promptService.considerUndefinedAsCancellation(value)));
  const tests = yield* selectApexClasses();
  return { suitename, tests };
});

/** Build (or extend) a suite via the apex-node TestService, with cancellable progress + completion sentinel. */
const buildSuite = Effect.fn('apexTestSuite.buildSuite')(function* (
  options: ApexTestSuiteOptions,
  executionNameKey: MessageKey
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const channelService = yield* api.services.ChannelService;
  const executionName = nls.localize(executionNameKey);
  // e2e specs gate completion on the `Ended SFDX: …` channel sentinel
  const appendEnded = channelService.appendToChannel(`Ended ${executionName}`);

  yield* api.services.ConnectionService.getConnection().pipe(
    Effect.flatMap(connection =>
      Effect.promise(() => new TestService(connection).buildSuite(options.suitename, options.tests))
    ),
    Effect.tapBoth({ onSuccess: () => appendEnded, onFailure: () => appendEnded }),
    promptService.withCancellableProgress(executionName)
  );

  OUTPUT_CHANNEL.show();
  notificationService.showSuccessfulExecution(executionName);

  // Clear all suite children so they re-query from org instead of using stale local files, then refresh
  const testController = getTestController();
  testController.clearAllSuiteChildren();
  yield* Effect.promise(() => testController.refresh());
});

export const apexTestSuiteAdd = Effect.fn('apexTestSuiteAdd')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ProjectService.getSfProject();
  const options = yield* gatherAddOptions();
  yield* buildSuite(options, 'apex_test_suite_add_text');
});

export const apexTestSuiteCreate = Effect.fn('apexTestSuiteCreate')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ProjectService.getSfProject();
  const options = yield* gatherCreateOptions();
  yield* buildSuite(options, 'apex_test_suite_create_text');
});

export const apexTestSuiteRun = Effect.fn('apexTestSuiteRun')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ProjectService.getSfProject();
  const promptService = yield* api.services.PromptService;

  const quickPickItems = yield* listApexTestSuiteItems();
  const selection = yield* Effect.promise(() =>
    vscode.window.showQuickPick<ApexTestQuickPickItem>(quickPickItems)
  ).pipe(Effect.flatMap(value => promptService.considerUndefinedAsCancellation(value)));

  yield* runSelectedTests(selection);
});
