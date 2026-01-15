/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApexTestResultData, TestLevel, TestResult, TestService } from '@salesforce/apex-node';
import { ApexDiagnostic } from '@salesforce/apex-node/lib/src/utils';
import { type NamedPackageDir } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { OUTPUT_CHANNEL } from '../channels';
import { getConnection } from '../coreExtensionUtils';
import { nls } from '../messages';
import { getServicesApi } from '../services/extensionProvider';
import * as settings from '../settings';
import { apexTestRunCacheService, isEmpty } from '../testRunCache';
import {
  EmptyParametersGatherer,
  getUriPath,
  LibraryCommandletExecutor,
  SfCommandlet,
  SfWorkspaceChecker,
  type ContinueResponse
} from '../utils/commandletHelpers';
import { notificationService } from '../utils/notificationHelpers';
import { getTestResultsFolder } from '../utils/pathHelpers';
import { runApexTests } from './apexTestRunUtils';
import { getZeroBasedRange } from './range';

export class ApexLibraryTestRunExecutor extends LibraryCommandletExecutor<{}> {
  protected cancellable: boolean = true;
  private readonly tests: string[];
  private readonly outputDir: string;
  private readonly codeCoverage: boolean;
  private readonly concise: boolean;
  public static diagnostics = vscode.languages.createDiagnosticCollection('apex-testing-errors');

  constructor(
    tests: string[],
    outputDir: string,
    codeCoverage = settings.retrieveTestCodeCoverage(),
    concise = settings.retrieveTestRunConcise()
  ) {
    super(nls.localize('apex_test_run_text'), 'apex_test_run_code_action_library', OUTPUT_CHANNEL);
    this.tests = tests;
    this.outputDir = outputDir;
    this.codeCoverage = codeCoverage;
    this.concise = concise;
  }

  public async run(
    _response?: ContinueResponse<{}>,
    progress?: vscode.Progress<{ message?: string }>,
    token?: vscode.CancellationToken
  ): Promise<boolean> {
    const connection = await getConnection();
    const testService = new TestService(connection);
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      this.tests.join(),
      undefined,
      undefined,
      undefined,
      !this.codeCoverage // the setting enables code coverage, so we need to pass false to disable it
    );

    const result = await runApexTests(
      {
        payload,
        outputDir: this.outputDir,
        codeCoverage: this.codeCoverage,
        concise: this.concise,
        telemetryTrigger: 'codeAction'
      },
      progress,
      token
    );

    if (!result) {
      return false;
    }

    await this.handleDiagnostics(result);
    return result.summary.outcome === 'Passed';
  }

  private async handleDiagnostics(result: TestResult): Promise<void> {
    ApexLibraryTestRunExecutor.diagnostics.clear();

    const testsWithDiagnostics = result.tests.filter(isTestWithDiagnostic);
    if (testsWithDiagnostics.length === 0) {
      return;
    }

    // Get project from services extension
    const servicesApi = await getServicesApi();
    // Provide all required dependencies for ProjectService
    const projectLayer = Layer.mergeAll(
      servicesApi.services.ProjectService.Default,
      servicesApi.services.WorkspaceService.Default
    );
    const sfProject = await Effect.runPromise(
      servicesApi.services.ProjectService.pipe(
        Effect.flatMap(service => service.getSfProject),
        Effect.provide(projectLayer)
      )
    );

    if (!sfProject) {
      return;
    }
    const packageDirectories = sfProject.getUniquePackageDirectories();
    const correlatedArtifacts = await this.mapApexArtifactToFilesystem(testsWithDiagnostics, packageDirectories);

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

        ApexLibraryTestRunExecutor.diagnostics.set(URI.file(componentPath), [vscDiagnostic]);
      }
    });
  }

  private async mapApexArtifactToFilesystem(
    tests: ApexTestResultData[],
    packageDirectories: NamedPackageDir[]
  ): Promise<Map<string, string>> {
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
        const fileName = path.basename(file.fsPath, '.cls');
        if (correlatedArtifacts.has(fileName)) {
          correlatedArtifacts.set(fileName, file.fsPath);
        }
      });

    return correlatedArtifacts;
  }
}

const apexTestRunCodeAction = async (tests: string[]) => {
  const outputDir = await getTempFolder();
  const testRunExecutor = new ApexLibraryTestRunExecutor(tests, outputDir);
  const commandlet = new SfCommandlet(new SfWorkspaceChecker(), new EmptyParametersGatherer(), testRunExecutor);
  await commandlet.run();
};

const getTempFolder = async (): Promise<string> => {
  if (vscode.workspace?.workspaceFolders) {
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
    // In web mode, use path instead of fsPath for virtual file systems
    const workspacePath = getUriPath(workspaceUri);
    const apexDir = await getTestResultsFolder(workspacePath, 'apex');
    return apexDir;
  } else {
    throw new Error(nls.localize('cannot_determine_workspace'));
  }
};

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

// evaluate test class param: if not provided, apply cached value
// exported for testability
const resolveTestClassParam = async (testClass: string): Promise<string> => {
  if (isEmpty(testClass)) {
    // value not provided for re-run invocations
    // apply cached value, if available
    if (apexTestRunCacheService.hasCachedClassTestParam()) {
      return apexTestRunCacheService.getLastClassTestParam();
    }
  } else {
    await apexTestRunCacheService.setCachedClassTestParam(testClass);
  }
  return testClass;
};

// invokes apex test run on all tests in a class
export const apexTestClassRunCodeAction = async (testClass: string) => {
  const resolved = await resolveTestClassParam(testClass);
  if (isEmpty(resolved)) {
    // test param not provided: show error and terminate
    void notificationService.showErrorMessage(nls.localize('apex_test_run_codeAction_no_class_test_param_text'));
    return;
  }

  await apexTestRunCodeAction([resolved]);
};

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

// evaluate test method param: if not provided, apply cached value
const resolveTestMethodParam = async (testMethod: string): Promise<string> => {
  if (isEmpty(testMethod)) {
    // value not provided for re-run invocations
    // apply cached value, if available
    if (apexTestRunCacheService.hasCachedMethodTestParam()) {
      return apexTestRunCacheService.getLastMethodTestParam();
    }
  } else {
    await apexTestRunCacheService.setCachedMethodTestParam(testMethod);
  }

  return testMethod;
};

// invokes apex test run on a test method
export const apexTestMethodRunCodeAction = async (testMethod: string) => {
  const resolved = await resolveTestMethodParam(testMethod);
  if (isEmpty(resolved)) {
    // test param not provided: show error and terminate
    void notificationService.showErrorMessage(nls.localize('apex_test_run_codeAction_no_method_test_param_text'));
    return;
  }

  await apexTestRunCodeAction([resolved]);
};

const isTestWithDiagnostic = (
  test: ApexTestResultData
): test is ApexTestResultData & { diagnostic: ApexDiagnostic[] } => 'diagnostic' in test;
