/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ProgressAndSuccessCommandKey } from '../utils/notificationMode';
import { type ApexDiagnostic, ApexTestResultData, TestLevel, TestResult } from '@salesforce/apex-node';
import { type NamedPackageDir } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { nls } from '../messages';
import { messages } from '../messages/i18n';
import { getApexTestingRuntime } from '../services/extensionProvider';
import { ApexTestRunCacheService } from '../testRunCache/apexTestRunCacheService';
import { apexTestingDiagnostics } from '../utils/diagnostics';
import { notificationService, showRunSuccessNotification } from '../utils/notificationHelpers';
import { getTestResultsFolder } from '../utils/pathHelpers';
import { openTestReport } from '../utils/testReportGenerator';
import { getRunCommandContext, resolveRunInputs, runApexTests } from './apexTestRunUtils';
import { getZeroBasedRange } from './range';

// Class/method run + their "last run" re-run variants all delegate here, sharing the "SFDX: Run Apex
// Tests" executionName from getRunCommandContext (pre-existing behavior), so one command key covers all.
const COMMAND: ProgressAndSuccessCommandKey = messages.apex_test_run_text;

class WorkspaceFolderError extends Schema.TaggedError<WorkspaceFolderError>()('WorkspaceFolderError', {
  message: Schema.String
}) {}

const toWorkspaceFolderError = () => new WorkspaceFolderError({ message: nls.localize('cannot_determine_workspace') });

// raised when a `last.*` re-run is invoked but nothing has been cached yet
class NoCachedTestError extends Schema.TaggedError<NoCachedTestError>()('NoCachedTestError', {
  message: Schema.String
}) {}

/** Run the given test class/method names, write diagnostics, and notify. */
const apexTestRunCodeAction = Effect.fn('apexTestRunCodeAction.run')(function* (tests: string[]) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ProjectService.getSfProject();
  const notificationMode = yield* api.services.NotificationModeService;
  const { promptService, channelService, executionName, appendEnded } = yield* getRunCommandContext();

  const { codeCoverage, concise, payload, outputDir } = yield* resolveRunInputs(
    (testService, cc) =>
      testService.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        tests.join(),
        undefined,
        undefined,
        undefined,
        !cc // the setting enables code coverage, so we need to pass false to disable it
      ),
    getTempFolder()
  );

  const progressLocation = yield* notificationMode.getProgressLocation(COMMAND);

  const { result, reportUri, outputFormat } = yield* runApexTests({
    payload,
    outputDir,
    codeCoverage,
    concise,
    telemetryTrigger: 'codeAction'
  }).pipe(
    Effect.tapBoth({ onSuccess: () => appendEnded, onFailure: () => appendEnded }),
    promptService.withCancellableProgress(executionName, progressLocation)
  );

  yield* channelService.showChannel;
  if (isUndefined(result)) {
    notificationService.showFailedExecution(executionName);
    return;
  }

  yield* handleDiagnostics(result);
  if (result.summary.outcome === 'Passed') {
    yield* showRunSuccessNotification(
      notificationMode,
      COMMAND,
      executionName,
      reportUri,
      outputFormat,
      (uri, format) => getApexTestingRuntime().runPromise(openTestReport(uri, format))
    );
  } else {
    notificationService.showFailedExecution(executionName);
  }
});

const handleDiagnostics = Effect.fn('apexTestRunCodeAction.handleDiagnostics')(function* (result: TestResult) {
  apexTestingDiagnostics.clear();

  const testsWithDiagnostics = result.tests.filter(isTestWithDiagnostic);
  if (testsWithDiagnostics.length === 0) {
    return;
  }

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const maybeProject = yield* Effect.option(api.services.ProjectService.getSfProject());
  if (Option.isNone(maybeProject)) {
    return;
  }

  const packageDirectories = maybeProject.value.getUniquePackageDirectories();
  const correlatedArtifacts = yield* mapApexArtifactToFilesystem(testsWithDiagnostics, packageDirectories);

  yield* Effect.forEach(
    testsWithDiagnostics,
    test => {
      const diagnostic = test.diagnostic;
      const componentUri = correlatedArtifacts.get(test.apexClass.fullName ?? test.apexClass.name);
      if (!componentUri) {
        return Effect.void;
      }
      const vscDiagnostic: vscode.Diagnostic = {
        message: `${diagnostic.exceptionMessage}\n${diagnostic.exceptionStackTrace}`,
        severity: vscode.DiagnosticSeverity.Error,
        source: componentUri.toString(),
        range: getZeroBasedRange(diagnostic.lineNumber ?? 1, diagnostic.columnNumber ?? 1)
      };
      return Effect.sync(() => apexTestingDiagnostics.set(componentUri, [vscDiagnostic]));
    },
    { concurrency: 1, discard: true }
  );
});

const mapApexArtifactToFilesystem = Effect.fn('apexTestRunCodeAction.mapApexArtifactToFilesystem')(function* (
  tests: ApexTestResultData[],
  packageDirectories: NamedPackageDir[]
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const classNames = new Set(tests.map(test => test.apexClass.fullName ?? test.apexClass.name));
  return yield* Effect.forEach(
    packageDirectories,
    pkgDir =>
      api.services.FsService.toUri(pkgDir.fullPath).pipe(
        Effect.map(packageDirUri => new vscode.RelativePattern(packageDirUri, '**/*.cls')),
        Effect.flatMap(pattern => api.services.FsService.findFiles(pattern, '**/node_modules/**'))
      ),
    { concurrency: 'unbounded' }
  ).pipe(
    Effect.map(matches => matches.flat()),
    Effect.map(matches => [...new Map(matches.map(uri => [uri.toString(), uri])).values()]),
    Effect.map(
      matches =>
        new Map(
          matches.flatMap(uri => {
            const fileName = Utils.basename(uri).slice(0, -'.cls'.length);
            return classNames.has(fileName) ? [[fileName, uri] as const] : [];
          })
        )
    )
  );
});

const getTempFolder = Effect.fn('apexTestRunCodeAction.getTempFolder')(function* () {
  return yield* getTestResultsFolder().pipe(
    Effect.catchTags({
      NoDefaultOrgError: toWorkspaceFolderError,
      NoWorkspaceOpenError: toWorkspaceFolderError
    })
  );
});

//   T E S T   C L A S S

// redirects to run-all-tests cmd
export const apexDebugClassRunCodeActionDelegate = (testClass: string) => {
  void vscode.commands.executeCommand('sf.test.view.debugTests', {
    name: testClass
  });
};

export const apexTestClassRunCodeActionDelegate = (testClass: string) => {
  void vscode.commands.executeCommand('sf.apex.test.class.run', testClass);
};

// invokes apex test run on all tests in a class; caches the class for later re-run
export const apexTestClassRunCodeAction = Effect.fn('apexTestClassRunCodeAction')(function* (testClass: string) {
  yield* ApexTestRunCacheService.setCachedClassTestParam(testClass);
  yield* apexTestRunCodeAction([testClass]);
});

// re-runs the last cached test class; invoked with no param, so resolves from cache
export const apexTestLastClassRunCodeAction = Effect.fn('apexTestLastClassRunCodeAction')(function* () {
  const cached = yield* ApexTestRunCacheService.getLastClassTestParam();
  if (Option.isNone(cached)) {
    // no cached class: nothing to re-run — surface a real error (the runtime toasts the message)
    return yield* new NoCachedTestError({
      message: nls.localize('apex_test_run_codeAction_no_class_test_param_text')
    });
  }
  yield* apexTestClassRunCodeAction(cached.value);
});

//   T E S T   M E T H O D

// redirects to run-test-method cmd
export const apexTestMethodRunCodeActionDelegate = (testMethod: string) => {
  void vscode.commands.executeCommand('sf.apex.test.method.run', testMethod);
};
export const apexDebugMethodRunCodeActionDelegate = (testMethod: string) => {
  void vscode.commands.executeCommand('sf.test.view.debugSingleTest', {
    name: testMethod
  });
};

// invokes apex test run on a test method; caches the method for later re-run
export const apexTestMethodRunCodeAction = Effect.fn('apexTestMethodRunCodeAction')(function* (testMethod: string) {
  yield* ApexTestRunCacheService.setCachedMethodTestParam(testMethod);
  yield* apexTestRunCodeAction([testMethod]);
});

// re-runs the last cached test method; invoked with no param, so resolves from cache
export const apexTestLastMethodRunCodeAction = Effect.fn('apexTestLastMethodRunCodeAction')(function* () {
  const cached = yield* ApexTestRunCacheService.getLastMethodTestParam();
  if (Option.isNone(cached)) {
    // no cached method: nothing to re-run — surface a real error (the runtime toasts the message)
    return yield* new NoCachedTestError({
      message: nls.localize('apex_test_run_codeAction_no_method_test_param_text')
    });
  }
  yield* apexTestMethodRunCodeAction(cached.value);
});

const isTestWithDiagnostic = (
  test: ApexTestResultData
): test is ApexTestResultData & { diagnostic: ApexDiagnostic[] } => 'diagnostic' in test;
