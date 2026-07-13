/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestService } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { MessageKey } from '../messages/i18n';
import { discoverTests } from '../testDiscovery/testDiscovery';
import { ApexTestQuickPickItem } from '../utils/fileHelpers';
import { notificationService } from '../utils/notificationHelpers';
import { getFullClassName, isFlowTest } from '../utils/toolingTestClassHelpers';
import { clearAllSuiteChildren, getTestController } from '../views/testController';
import { runSelectedTests } from './apexTestRun';

type ApexTestSuiteOptions = { suitename: string; tests: string[] };

const listApexClassItems = Effect.fn('apexTestSuite.listApexClassItems')(function* () {
  const result = yield* discoverTests();
  return result.classes
    .filter(cls => !isFlowTest(cls))
    .map(
      (cls): ApexTestQuickPickItem => ({
        label: cls.name,
        description: Option.getOrUndefined(cls.namespacePrefix),
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
  // Query directly to get the correctly-cased Id field (retrieveAllSuites types it as lowercase `id`)
  const result = yield* Effect.tryPromise(() =>
    connection.tooling.query<{ Id: string; TestSuiteName: string }>('SELECT Id, TestSuiteName FROM ApexTestSuite')
  );

  if (result.records.length === 0) {
    void vscode.window.showInformationMessage(nls.localize('apex_test_suite_no_suites_message'));
    return yield* new api.services.UserCancellationError();
  }

  return result.records.map(
    (testSuite): ApexTestQuickPickItem => ({
      label: testSuite.TestSuiteName,
      description: testSuite.Id,
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

/** QuickPickItem with optional membership ID and picked state for editing. */
type EditableSuiteClassItem = ApexTestQuickPickItem & { membershipId?: string; picked: boolean };

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

/** Gather edit options: pick suite, show all classes with current members pre-checked. Returns diff to apply. */
const gatherEditOptions = Effect.fn('apexTestSuite.gatherEditOptions')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  // Pick the suite
  const quickPickItems = yield* listApexTestSuiteItems();
  const testSuite = yield* Effect.promise(() =>
    vscode.window.showQuickPick<ApexTestQuickPickItem>(quickPickItems)
  ).pipe(Effect.flatMap(value => promptService.considerUndefinedAsCancellation(value)));

  const suitename = testSuite.label;
  const suiteId = testSuite.description ?? '';
  const escapedSuiteId = suiteId.replaceAll("'", "''");

  const connection = yield* api.services.ConnectionService.getConnection();

  // Fetch current membership AND all available classes in parallel
  const [memberships, allClasses] = yield* Effect.all(
    [
      Effect.tryPromise(() =>
        connection.tooling.query<{ Id: string; ApexClassId: string }>(
          `SELECT Id, ApexClassId FROM TestSuiteMembership WHERE ApexTestSuiteId = '${escapedSuiteId}'`
        )
      ),
      listApexClassItems().pipe(promptService.withCancellableProgress(nls.localize('retrieving_tests_message')))
    ],
    { concurrency: 'unbounded' }
  );

  // Build a map from ApexClassId -> membership ID
  const membershipByClassId = new Map(memberships.records.map(r => [r.ApexClassId, r.Id]));

  // Query ApexClass IDs for all classes to match against membership records
  const classNames = allClasses.map(cls => `'${(cls.fullClassName ?? cls.label).replaceAll("'", "''")}'`).join(',');
  const classIdResult = yield* Effect.tryPromise(() =>
    connection.tooling.query<{ Id: string; Name: string; NamespacePrefix?: string | null }>(
      `SELECT Id, Name, NamespacePrefix FROM ApexClass WHERE Name IN (${classNames})`
    )
  );

  // Build a map from qualified name -> ApexClass ID
  const classIdByQualifiedName = new Map(
    classIdResult.records.map(r => {
      const qualifiedName = r.NamespacePrefix ? `${r.NamespacePrefix}.${r.Name}` : r.Name;
      return [qualifiedName, r.Id];
    })
  );

  // Build editable items: all classes, with picked=true + membershipId for current members
  const editableItems: EditableSuiteClassItem[] = allClasses.map(cls => {
    const qualifiedName = cls.fullClassName ?? cls.label;
    const classId = classIdByQualifiedName.get(qualifiedName);
    const membershipId = classId ? membershipByClassId.get(classId) : undefined;
    return {
      ...cls,
      membershipId,
      picked: !!membershipId
    };
  });

  // Show multi-select quick pick
  const selection = yield* Effect.promise(() =>
    vscode.window.showQuickPick<EditableSuiteClassItem>(editableItems, { canPickMany: true })
  );
  // undefined means dismissed (click outside / Escape) — cancel without modifying the suite
  if (selection === undefined) {
    return yield* new api.services.UserCancellationError();
  }
  if (selection.length === 0) {
    // Empty array means user accepted with nothing checked — remove all current members
    const allMembershipIds = editableItems.filter(item => item.membershipId).map(item => item.membershipId!);
    return { suitename, toAdd: [], toRemove: allMembershipIds };
  }

  // Diff: newly checked → add, unchecked → remove.
  // Key on fullClassName/label (unique per class), NOT description (namespace prefix — empty for all local classes,
  // which would make every class appear "selected" and prevent any removals).
  const selectedClassNames = new Set(selection.map(item => item.fullClassName ?? item.label));
  const toAdd = selection.filter(item => !item.membershipId).map(item => item.fullClassName ?? item.label);
  const toRemove = editableItems
    .filter(item => item.membershipId && !selectedClassNames.has(item.fullClassName ?? item.label))
    .map(item => item.membershipId!);

  return { suitename, toAdd, toRemove };
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

  yield* channelService.showChannel;
  notificationService.showSuccessfulExecution(executionName);

  // Clear all suite children so they re-query from org instead of using stale local files, then refresh
  clearAllSuiteChildren();
  yield* Effect.promise(() => getTestController().refresh());
});

/** Apply suite edits: add new classes and/or remove existing ones, then refresh. */
const applyEdits = Effect.fn('apexTestSuite.applyEdits')(function* (
  suitename: string,
  toAdd: string[],
  toRemove: string[]
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const channelService = yield* api.services.ChannelService;
  const executionName = nls.localize('apex_test_suite_edit_text');
  const appendEnded = channelService.appendToChannel(`Ended ${executionName}`);

  const connection = yield* api.services.ConnectionService.getConnection();
  const testService = new TestService(connection);

  const applyEffect = Effect.all(
    [
      toAdd.length > 0 ? Effect.promise(() => testService.buildSuite(suitename, toAdd)) : Effect.succeed(undefined),
      toRemove.length > 0
        ? Effect.tryPromise(() =>
            Promise.all(toRemove.map(id => connection.tooling.delete('TestSuiteMembership', id)))
          ).pipe(
            Effect.flatMap(results => {
              const failures = results.filter(r => !r.success);
              if (failures.length > 0) {
                return Effect.fail(new Error(`Failed to delete ${failures.length} membership(s)`));
              }
              return Effect.succeed(results);
            })
          )
        : Effect.succeed(undefined)
    ],
    { concurrency: 'unbounded' }
  );

  yield* applyEffect.pipe(
    Effect.tapBoth({ onSuccess: () => appendEnded, onFailure: () => appendEnded }),
    promptService.withCancellableProgress(executionName)
  );

  yield* channelService.showChannel;
  notificationService.showSuccessfulExecution(executionName);

  // Clear all suite children so they re-query from org instead of using stale local files, then refresh
  clearAllSuiteChildren();
  yield* Effect.promise(() => getTestController().refresh());
});

export const apexTestSuiteEdit = Effect.fn('apexTestSuiteEdit')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ProjectService.getSfProject();
  const { suitename, toAdd, toRemove } = yield* gatherEditOptions();
  yield* applyEdits(suitename, toAdd, toRemove);
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
