/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApexTestResultData, TestLevel, TestResult, TestService } from '@salesforce/apex-node';
import { ApexDiagnostic } from '@salesforce/apex-node/lib/src/utils';
import { type NamedPackageDir } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { OUTPUT_CHANNEL } from '../channels';
import { nls } from '../messages';
import * as settings from '../settings';
import { ApexTestRunCacheService } from '../testRunCache/apexTestRunCacheService';
import { apexTestingDiagnostics } from '../utils/diagnostics';
import { notificationService } from '../utils/notificationHelpers';
import { getTestResultsFolder } from '../utils/pathHelpers';
import { runApexTests } from './apexTestRunUtils';
import { getZeroBasedRange } from './range';

class WorkspaceFolderError extends Schema.TaggedError<WorkspaceFolderError>()('WorkspaceFolderError', {
  message: Schema.String
}) {}

// raised when a `last.*` re-run is invoked but nothing has been cached yet
class NoCachedTestError extends Schema.TaggedError<NoCachedTestError>()('NoCachedTestError', {
  message: Schema.String
}) {}

/** Run the given test class/method names, write diagnostics, and notify. */
const apexTestRunCodeAction = Effect.fn('apexTestRunCodeAction.run')(function* (tests: string[]) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ProjectService.getSfProject();
  const promptService = yield* api.services.PromptService;
  const channelService = yield* api.services.ChannelService;
  const executionName = nls.localize('apex_test_run_text');
  // e2e specs gate completion on the `Ended SFDX: …` channel sentinel
  const appendEnded = channelService.appendToChannel(`Ended ${executionName}`);

  const codeCoverage = settings.retrieveTestCodeCoverage();

  const { payload, outputDir } = yield* Effect.all(
    {
      payload: api.services.ConnectionService.getConnection().pipe(
        Effect.flatMap(connection =>
          Effect.promise(() =>
            new TestService(connection).buildAsyncPayload(
              TestLevel.RunSpecifiedTests,
              tests.join(),
              undefined,
              undefined,
              undefined,
              !codeCoverage // the setting enables code coverage, so we need to pass false to disable it
            )
          )
        )
      ),
      outputDir: getTempFolder()
    },
    { concurrency: 'unbounded' }
  );

  const result = yield* runApexTests({
    payload,
    outputDir,
    codeCoverage,
    concise: settings.retrieveTestRunConcise(),
    telemetryTrigger: 'codeAction'
  }).pipe(
    Effect.tapBoth({ onSuccess: () => appendEnded, onFailure: () => appendEnded }),
    promptService.withCancellableProgress(executionName)
  );

  OUTPUT_CHANNEL.show();
  if (result === undefined) {
    notificationService.showFailedExecution(executionName);
    return;
  }

  yield* handleDiagnostics(result);
  if (result.summary.outcome === 'Passed') {
    notificationService.showSuccessfulExecution(executionName);
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
  const correlatedArtifacts = yield* Effect.promise(() =>
    mapApexArtifactToFilesystem(testsWithDiagnostics, packageDirectories)
  );

  testsWithDiagnostics.forEach(test => {
    const diagnostic = test.diagnostic;
    const componentPath = correlatedArtifacts.get(test.apexClass.fullName ?? test.apexClass.name);

    if (componentPath) {
      const vscDiagnostic: vscode.Diagnostic = {
        message: `${diagnostic.exceptionMessage}\n${diagnostic.exceptionStackTrace}`,
        severity: vscode.DiagnosticSeverity.Error,
        source: componentPath,
        range: getZeroBasedRange(diagnostic.lineNumber ?? 1, diagnostic.columnNumber ?? 1)
      };

      apexTestingDiagnostics.set(URI.file(componentPath), [vscDiagnostic]);
    }
  });
});

const mapApexArtifactToFilesystem = async (
  tests: ApexTestResultData[],
  packageDirectories: NamedPackageDir[]
): Promise<Map<string, string>> => {
  const correlatedArtifacts: Map<string, string> = new Map(
    tests.map(test => [test.apexClass.fullName ?? test.apexClass.name, 'unknown'])
  );

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return correlatedArtifacts;
  }

  Array.from(
    new Set(
      (
        await Promise.all(
          packageDirectories
            .map(pkgDir => `${path.relative(workspaceFolder.uri.fsPath, pkgDir.fullPath)}/**/*.cls`)
            .flatMap(pattern => vscode.workspace.findFiles(pattern, '**/node_modules/**'))
        )
      )
        .flat()
        // parsing to string for set to dedupe, then back to URI
        .map(uri => uri.toString())
    )
  )
    .map(filePath => URI.parse(filePath))
    .map(file => {
      const fileName = Utils.basename(file).slice(0, -'.cls'.length);
      if (correlatedArtifacts.has(fileName)) {
        correlatedArtifacts.set(fileName, file.fsPath);
      }
    });

  return correlatedArtifacts;
};

const getTempFolder = Effect.fn('apexTestRunCodeAction.getTempFolder')(function* () {
  return yield* Effect.tryPromise({
    try: () => getTestResultsFolder(),
    catch: () => new WorkspaceFolderError({ message: nls.localize('cannot_determine_workspace') })
  });
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
