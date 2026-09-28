/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ProgressAndSuccessCommandKey } from '../utils/notificationMode';
import { TestService } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import * as Order from 'effect/Order';
import { isUndefined, not } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { messages, MessageKey } from '../messages/i18n';
import { discoverTests } from '../testDiscovery/testDiscovery';
import { ApexTestQuickPickItem } from '../utils/fileHelpers';
import { getFullClassName, isFlowTest } from '../utils/toolingTestClassHelpers';
import { clearAllSuiteChildren, getTestController } from '../views/testController';
import { runSelectedTests } from './apexTestRun';

type ApexTestSuiteOptions = { suitename: string; tests: string[] };

const SuiteRow = Schema.Struct({ Id: Schema.String, TestSuiteName: Schema.String });
const MembershipRow = Schema.Struct({ Id: Schema.String, ApexClassId: Schema.String });
const ClassIdRow = Schema.Struct({
  Id: Schema.String,
  Name: Schema.String,
  NamespacePrefix: Schema.optionalWith(Schema.String, { nullable: true })
});

const toolingRecords = <A, I>(soql: string, schema: Schema.Schema<A, I, never>) =>
  Effect.flatMap(ExtensionProviderService, provider => provider.getServicesApi).pipe(
    Effect.flatMap(api => api.services.QueryService),
    Effect.flatMap(queryService => queryService.query({ soql, tooling: true }, schema)),
    Effect.map(result => result.records)
  );

class SuiteMembershipDeleteError extends Schema.TaggedError<SuiteMembershipDeleteError>()(
  'SuiteMembershipDeleteError',
  {
    message: Schema.String
  }
) {}

/** Sort by label, tie-break on fully-qualified name — case-insensitive so `zebraTest` doesn't follow every PascalCase name */
const byClassName = Order.combine(
  Order.mapInput(Order.string, (item: ApexTestQuickPickItem) => item.label.toLowerCase()),
  Order.mapInput(Order.string, (item: ApexTestQuickPickItem) => (item.fullClassName ?? '').toLowerCase())
);

const listApexClassItems = Effect.fn('apexTestSuite.listApexClassItems')(() =>
  discoverTests().pipe(
    Effect.map(result => result.classes),
    Effect.map(Arr.filter(not(isFlowTest))),
    Effect.map(
      Arr.map(
        (cls): ApexTestQuickPickItem => ({
          label: cls.name,
          description: Option.getOrUndefined(cls.namespacePrefix),
          type: 'Class',
          fullClassName: getFullClassName(cls)
        })
      )
    ),
    Effect.map(Arr.sortBy(byClassName))
  )
);

const listApexTestSuiteItems = Effect.fn('apexTestSuite.listApexTestSuiteItems')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  // Query directly to get the correctly-cased Id field (retrieveAllSuites types it as lowercase `id`)
  const result = yield* toolingRecords('SELECT Id, TestSuiteName FROM ApexTestSuite', SuiteRow);

  if (result.length === 0) {
    void vscode.window.showInformationMessage(nls.localize('apex_test_suite_no_suites_message'));
    return yield* new api.services.UserCancellationError();
  }

  return result.map(
    (testSuite): ApexTestQuickPickItem => ({
      label: testSuite.TestSuiteName,
      description: testSuite.Id,
      type: 'Suite'
    })
  );
});

/** Prompt for the apex classes to include in a suite. Fails with UserCancellationError on dismiss/empty. */
const selectApexClasses = Effect.fn('apexTestSuite.selectApexClasses')(function* (
  command: ProgressAndSuccessCommandKey
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const selection = yield* Effect.all({
    promptService: api.services.PromptService,
    progressLocation: api.services.NotificationModeService.pipe(
      Effect.flatMap(notificationMode => notificationMode.getProgressLocation(command))
    )
  }).pipe(
    Effect.flatMap(({ promptService, progressLocation }) =>
      listApexClassItems().pipe(
        promptService.withCancellableProgress(nls.localize('retrieving_tests_message'), progressLocation)
      )
    ),
    Effect.flatMap(apexClassItems =>
      Effect.promise(() => vscode.window.showQuickPick<ApexTestQuickPickItem>(apexClassItems, { canPickMany: true }))
    )
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
  return yield* Effect.all({
    suitename: Effect.flatMap(ExtensionProviderService, provider => provider.getServicesApi).pipe(
      Effect.flatMap(api => api.services.PromptService),
      Effect.flatMap(promptService =>
        Effect.flatMap(
          Effect.promise(() =>
            vscode.window.showInputBox({ prompt: nls.localize('apex_test_suite_name_input_prompt') })
          ),
          value => promptService.considerUndefinedAsCancellation(value)
        )
      )
    ),
    tests: selectApexClasses(messages.apex_test_suite_create_text)
  });
});

/** Gather edit options: pick suite, show all classes with current members pre-checked. Returns diff to apply. */
const gatherEditOptions = Effect.fn('apexTestSuite.gatherEditOptions')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  // Pick the suite
  const testSuite = yield* listApexTestSuiteItems().pipe(
    Effect.flatMap(quickPickItems =>
      Effect.promise(() => vscode.window.showQuickPick<ApexTestQuickPickItem>(quickPickItems))
    ),
    Effect.flatMap(value => promptService.considerUndefinedAsCancellation(value))
  );

  const suitename = testSuite.label;

  // Fetch current membership AND all available classes in parallel, then ApexClass ids for those names.
  // Use cls.label (= ApexClass.Name, without namespace) not fullClassName — the Name column never contains the namespace prefix.
  // Membership map is ApexClassId -> membership Id. Class map is qualified name -> ApexClass Id.
  const editableItems: EditableSuiteClassItem[] = yield* Effect.all(
    {
      membershipByClassId: toolingRecords(
        `SELECT Id, ApexClassId FROM TestSuiteMembership WHERE ApexTestSuiteId = '${(testSuite.description ?? '').replaceAll("'", "''")}'`,
        MembershipRow
      ).pipe(Effect.map(rows => new Map(rows.map(row => [row.ApexClassId, row.Id])))),
      classes: api.services.NotificationModeService.pipe(
        Effect.flatMap(notificationMode => notificationMode.getProgressLocation(messages.apex_test_suite_edit_text)),
        Effect.flatMap(progressLocation =>
          listApexClassItems().pipe(
            promptService.withCancellableProgress(nls.localize('retrieving_tests_message'), progressLocation)
          )
        )
      )
    },
    { concurrency: 'unbounded' }
  ).pipe(
    Effect.flatMap(({ membershipByClassId, classes }) =>
      Effect.map(
        toolingRecords(
          `SELECT Id, Name, NamespacePrefix FROM ApexClass WHERE Name IN (${classes
            .map(cls => `'${cls.label.replaceAll("'", "''")}'`)
            .join(',')})`,
          ClassIdRow
        ),
        classRows => {
          const classIdByQualifiedName = new Map(
            classRows.map(row => [row.NamespacePrefix ? `${row.NamespacePrefix}.${row.Name}` : row.Name, row.Id])
          );
          return classes.map((cls): EditableSuiteClassItem => {
            const classId = classIdByQualifiedName.get(cls.fullClassName ?? cls.label);
            const membershipId = classId ? membershipByClassId.get(classId) : undefined;
            return {
              ...cls,
              membershipId,
              picked: !!membershipId
            };
          });
        }
      )
    )
  );

  // Show multi-select quick pick
  const selection = yield* Effect.promise(() =>
    vscode.window.showQuickPick<EditableSuiteClassItem>(editableItems, { canPickMany: true })
  );
  // undefined means dismissed (click outside / Escape) — cancel without modifying the suite
  if (isUndefined(selection)) {
    return yield* new api.services.UserCancellationError();
  }
  if (selection.length === 0) {
    // Empty array means user accepted with nothing checked — remove all current members
    return {
      suitename,
      toAdd: [],
      toRemove: editableItems.filter(item => item.membershipId).map(item => item.membershipId!)
    };
  }

  // Diff: newly checked → add, unchecked → remove.
  // Key on fullClassName/label (unique per class), NOT description (namespace prefix — empty for all local classes,
  // which would make every class appear "selected" and prevent any removals).
  return pipe(new Set(selection.map(item => item.fullClassName ?? item.label)), selectedClassNames => ({
    suitename,
    toAdd: selection.filter(item => !item.membershipId).map(item => item.fullClassName ?? item.label),
    toRemove: editableItems
      .filter(item => item.membershipId && !selectedClassNames.has(item.fullClassName ?? item.label))
      .map(item => item.membershipId!)
  }));
});

/** Build (or extend) a suite via the apex-node TestService, with cancellable progress + completion sentinel. */
const buildSuite = Effect.fn('apexTestSuite.buildSuite')(function* (
  options: ApexTestSuiteOptions,
  executionNameKey: MessageKey,
  command: ProgressAndSuccessCommandKey
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  const notificationMode = yield* api.services.NotificationModeService;
  const executionName = nls.localize(executionNameKey);
  // e2e specs gate completion on the `Ended SFDX: …` channel sentinel
  const appendEnded = channelService.appendToChannel(`Ended ${executionName}`);

  yield* Effect.all({
    promptService: api.services.PromptService,
    progressLocation: notificationMode.getProgressLocation(command),
    connection: api.services.ConnectionService.getConnection()
  }).pipe(
    Effect.flatMap(({ promptService, progressLocation, connection }) =>
      Effect.promise(() => new TestService(connection).buildSuite(options.suitename, options.tests)).pipe(
        Effect.tapBoth({ onSuccess: () => appendEnded, onFailure: () => appendEnded }),
        promptService.withCancellableProgress(executionName, progressLocation)
      )
    )
  );

  yield* channelService.showChannel;
  yield* notificationMode.showSuccessNotification(
    command,
    nls.localize('apex_test_successful_execution_message', executionName)
  );

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
  const channelService = yield* api.services.ChannelService;
  const notificationMode = yield* api.services.NotificationModeService;
  const executionName = nls.localize('apex_test_suite_edit_text');
  const appendEnded = channelService.appendToChannel(`Ended ${executionName}`);

  const connection = yield* api.services.ConnectionService.getConnection();
  yield* Effect.all({
    promptService: api.services.PromptService,
    progressLocation: notificationMode.getProgressLocation(messages.apex_test_suite_edit_text)
  }).pipe(
    Effect.flatMap(({ promptService, progressLocation }) =>
      Effect.all(
        [
          toAdd.length > 0
            ? Effect.promise(() => new TestService(connection).buildSuite(suitename, toAdd))
            : Effect.void,
          toRemove.length > 0
            ? Effect.flatMap(
                Effect.tryPromise(() =>
                  Promise.all(toRemove.map(id => connection.tooling.delete('TestSuiteMembership', id)))
                ),
                results => {
                  const failures = results.filter(result => !result.success);
                  return failures.length > 0
                    ? Effect.fail(
                        new SuiteMembershipDeleteError({
                          message: nls.localize('apex_test_suite_membership_delete_failed_message', failures.length)
                        })
                      )
                    : Effect.succeed(results);
                }
              )
            : Effect.void
        ],
        { concurrency: 'unbounded' }
      ).pipe(
        Effect.tapBoth({ onSuccess: () => appendEnded, onFailure: () => appendEnded }),
        promptService.withCancellableProgress(executionName, progressLocation)
      )
    )
  );

  yield* channelService.showChannel;
  yield* notificationMode.showSuccessNotification(
    messages.apex_test_suite_edit_text,
    nls.localize('apex_test_successful_execution_message', executionName)
  );

  // Clear all suite children so they re-query from org instead of using stale local files, then refresh
  clearAllSuiteChildren();
  yield* Effect.promise(() => getTestController().refresh());
});

export const apexTestSuiteEdit = Effect.fn('apexTestSuiteEdit')(function* () {
  yield* Effect.flatMap(ExtensionProviderService, provider => provider.getServicesApi).pipe(
    Effect.flatMap(api => api.services.ProjectService.getSfProject())
  );
  yield* gatherEditOptions().pipe(
    Effect.flatMap(({ suitename, toAdd, toRemove }) => applyEdits(suitename, toAdd, toRemove))
  );
});

export const apexTestSuiteCreate = Effect.fn('apexTestSuiteCreate')(function* () {
  yield* Effect.flatMap(ExtensionProviderService, provider => provider.getServicesApi).pipe(
    Effect.flatMap(api => api.services.ProjectService.getSfProject())
  );
  yield* gatherCreateOptions().pipe(
    Effect.flatMap(options => buildSuite(options, 'apex_test_suite_create_text', messages.apex_test_suite_create_text))
  );
});

export const apexTestSuiteRun = Effect.fn('apexTestSuiteRun')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ProjectService.getSfProject();
  yield* Effect.all({
    promptService: api.services.PromptService,
    quickPickItems: listApexTestSuiteItems()
  }).pipe(
    Effect.flatMap(({ promptService, quickPickItems }) =>
      Effect.flatMap(
        Effect.promise(() => vscode.window.showQuickPick<ApexTestQuickPickItem>(quickPickItems)),
        value => promptService.considerUndefinedAsCancellation(value)
      )
    ),
    Effect.flatMap(selection => runSelectedTests(selection))
  );
});
