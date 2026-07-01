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
    // retrieveAllSuites is typed with lowercase `id` but the tooling API returns `Id` at runtime
    (testSuite): ApexTestQuickPickItem => ({
      label: testSuite.TestSuiteName,
      description: Object.entries(testSuite).find(([k]) => k.toLowerCase() === 'id')?.[1] ?? '',
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

/** QuickPickItem carrying the TestSuiteMembership record ID for removal. */
type RemovableClassItem = ApexTestQuickPickItem & { membershipId: string };

/** Prompt user to pick a suite and select which classes to remove. Returns membership IDs to delete. */
const gatherRemoveOptions = Effect.fn('apexTestSuite.gatherRemoveOptions')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  // Pick the suite
  const quickPickItems = yield* listApexTestSuiteItems();
  const testSuite = yield* Effect.promise(() =>
    vscode.window.showQuickPick<ApexTestQuickPickItem>(quickPickItems)
  ).pipe(Effect.flatMap(value => promptService.considerUndefinedAsCancellation(value)));

  const suiteId = testSuite.description ?? '';
  const escapedSuiteId = suiteId.replaceAll("'", "''");

  // Query TestSuiteMembership records for the selected suite
  const connection = yield* api.services.ConnectionService.getConnection();
  const memberships = yield* Effect.tryPromise(() =>
    connection.tooling.query<{ Id: string; ApexClassId: string }>(
      `SELECT Id, ApexClassId FROM TestSuiteMembership WHERE ApexTestSuiteId = '${escapedSuiteId}'`
    )
  );

  if (memberships.records.length === 0) {
    void vscode.window.showInformationMessage(nls.localize('apex_test_suite_empty_remove_message'));
    return yield* new api.services.UserCancellationError();
  }

  // Resolve class names from ApexClassIds
  const classIds = memberships.records.map(r => r.ApexClassId);
  const inClause = classIds.map(id => `'${id.replaceAll("'", "''")}'`).join(',');
  const classResult = yield* Effect.tryPromise(() =>
    connection.tooling.query<{ Id: string; Name: string; NamespacePrefix?: string | null }>(
      `SELECT Id, Name, NamespacePrefix FROM ApexClass WHERE Id IN (${inClause})`
    )
  );

  // Build a map from ApexClassId -> class info
  const classInfoById = new Map(classResult.records.map(r => [r.Id, r]));

  // Build RemovableClassItem[] for multi-select quick pick
  const removableItems: RemovableClassItem[] = memberships.records
    .flatMap((membership): RemovableClassItem[] => {
      const classInfo = classInfoById.get(membership.ApexClassId);
      if (!classInfo) return [];
      return [
        {
          label: classInfo.Name,
          description: classInfo.NamespacePrefix ?? '',
          type: 'Class' as const,
          membershipId: membership.Id
        }
      ];
    })
    .toSorted((a, b) => a.label.localeCompare(b.label));

  // Show multi-select quick pick
  const selection = yield* Effect.promise(() =>
    vscode.window.showQuickPick<RemovableClassItem>(removableItems, { canPickMany: true })
  );
  if (!selection || selection.length === 0) {
    return yield* new api.services.UserCancellationError();
  }

  return selection.map(item => item.membershipId);
});

/** Delete selected TestSuiteMembership records and refresh the test controller. */
const removeSuiteMembers = Effect.fn('apexTestSuite.removeSuiteMembers')(function* (membershipIds: string[]) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const channelService = yield* api.services.ChannelService;
  const executionName = nls.localize('apex_test_suite_remove_text');
  const appendEnded = channelService.appendToChannel(`Ended ${executionName}`);

  yield* api.services.ConnectionService.getConnection().pipe(
    Effect.flatMap(connection =>
      // tooling.delete with an array routes through composite/sobjects which the Tooling API
      // does not support — delete each record individually instead
      Effect.tryPromise(() =>
        Promise.all(membershipIds.map(id => connection.tooling.delete('TestSuiteMembership', id)))
      )
    ),
    Effect.flatMap(results => {
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        return Effect.fail(new Error(`Failed to delete ${failures.length} membership(s)`));
      }
      return Effect.succeed(results);
    }),
    Effect.tapBoth({ onSuccess: () => appendEnded, onFailure: () => appendEnded }),
    promptService.withCancellableProgress(executionName)
  );

  OUTPUT_CHANNEL.show();
  void vscode.window.showInformationMessage(nls.localize('apex_test_successful_execution_message', executionName));

  // Clear all suite children so they re-query from org instead of using stale local files, then refresh
  const testController = getTestController();
  testController.clearAllSuiteChildren();
  yield* Effect.promise(() => testController.refresh());
});

export const apexTestSuiteRemove = Effect.fn('apexTestSuiteRemove')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ProjectService.getSfProject();
  const membershipIds = yield* gatherRemoveOptions();
  yield* removeSuiteMembers(membershipIds);
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
