/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ApexTestProgressValue,
  ApexTestResultData,
  HumanReporter,
  Progress,
  ResultFormat,
  TestLevel,
  TestResult,
  TestService
} from '@salesforce/apex-node-bundle';
import { ApexDiagnostic } from '@salesforce/apex-node-bundle/lib/src/utils';
import { NamedPackageDir, SfProject } from '@salesforce/core-bundle';
import {
  ContinueResponse,
  EmptyParametersGatherer,
  getRootWorkspacePath,
  getTestResultsFolder,
  LibraryCommandletExecutor,
  notificationService,
  SfCommandlet,
  SfWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import * as settings from '../settings';
import { apexTestRunCacheService, isEmpty } from '../testRunCache';
import { getZeroBasedRange } from './range';

export class ApexLibraryTestRunExecutor extends LibraryCommandletExecutor<{}> {
  protected cancellable: boolean = true;
  private tests: string[];
  private codeCoverage: boolean = false;
  private outputDir: string;

  public static diagnostics = vscode.languages.createDiagnosticCollection('apex-errors');

  constructor(tests: string[], outputDir = getTempFolder(), codeCoverage = settings.retrieveTestCodeCoverage()) {
    super(nls.localize('apex_test_run_text'), 'apex_test_run_code_action_library', OUTPUT_CHANNEL);
    this.tests = tests;
    this.outputDir = outputDir;
    this.codeCoverage = codeCoverage;
  }

  public async run(
    response?: ContinueResponse<{}>,
    progress?: vscode.Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    token?: vscode.CancellationToken
  ): Promise<boolean> {
    const connection = await workspaceContext.getConnection();
    const testService = new TestService(connection);
    const payload = await testService.buildAsyncPayload(TestLevel.RunSpecifiedTests, this.tests.join());

    const progressReporter: Progress<ApexTestProgressValue> = {
      report: value => {
        if (value.type === 'StreamingClientProgress' || value.type === 'FormatTestResultProgress') {
          progress?.report({ message: value.message });
        }
      }
    };
    const result = (await testService.runTestAsynchronous(
      payload,
      this.codeCoverage,
      false,
      progressReporter,
      token
    )) as TestResult;

    if (token?.isCancellationRequested) {
      return false;
    }

    await testService.writeResultFiles(
      result,
      { resultFormats: [ResultFormat.json], dirPath: this.outputDir },
      this.codeCoverage
    );
    const humanOutput = new HumanReporter().format(result, this.codeCoverage);
    channelService.appendLine(humanOutput);

    await this.handleDiagnostics(result);
    return result.summary.outcome === 'Passed';
  }

  private async handleDiagnostics(result: TestResult): Promise<void> {
    ApexLibraryTestRunExecutor.diagnostics.clear();
    const projectPath = getRootWorkspacePath();
    const project = await SfProject.resolve(projectPath);

    const testsWithDiagnostics = result.tests.filter(test => test.diagnostic);
    if (testsWithDiagnostics.length === 0) {
      return;
    }

    const correlatedArtifacts = await this.mapApexArtifactToFilesystem(
      testsWithDiagnostics,
      project.getPackageDirectories()
    );

    testsWithDiagnostics.forEach(test => {
      const diagnostic = test.diagnostic as ApexDiagnostic;
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
    const correlatedArtifacts: Map<string, string> = new Map();

    for (const test of tests) {
      const testName = test.apexClass.fullName ?? test.apexClass.name;
      correlatedArtifacts.set(testName, 'unknown');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : undefined;
    if (!workspaceFolder) {
      return correlatedArtifacts;
    }

    const patterns = packageDirectories.map(pkgDir => {
      const relativePath = path.relative(workspaceFolder.uri.fsPath, pkgDir.fullPath);
      return `${relativePath}/**/*.cls`;
    });

    const findFilesPromises = patterns.map(pattern => vscode.workspace.findFiles(pattern, '**/node_modules/**'));

    const filesWithDuplicates = (await Promise.all(findFilesPromises)).flat();

    const files = Array.from(new Set(filesWithDuplicates.map(file => file.toString()))).map(filePath =>
      URI.parse(filePath)
    );

    for (const file of files) {
      const fileName = path.basename(file.fsPath, '.cls');

      if (correlatedArtifacts.has(fileName)) {
        correlatedArtifacts.set(fileName, file.fsPath);
      }
    }
    return correlatedArtifacts;
  }
}

const apexTestRunCodeAction = async (tests: string[]) => {
  const testRunExecutor = new ApexLibraryTestRunExecutor(tests);
  const commandlet = new SfCommandlet(new SfWorkspaceChecker(), new EmptyParametersGatherer(), testRunExecutor);
  await commandlet.run();
};

const getTempFolder = (): string => {
  if (vscode.workspace && vscode.workspace.workspaceFolders) {
    const apexDir = getTestResultsFolder(vscode.workspace.workspaceFolders[0].uri.fsPath, 'apex');
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
export const resolveTestClassParam = async (testClass: string): Promise<string> => {
  if (isEmpty(testClass)) {
    // value not provided for re-run invocations
    // apply cached value, if available
    if (apexTestRunCacheService.hasCachedClassTestParam()) {
      testClass = apexTestRunCacheService.getLastClassTestParam();
    }
  } else {
    await apexTestRunCacheService.setCachedClassTestParam(testClass);
  }
  return testClass;
};

// invokes apex test run on all tests in a class
export const apexTestClassRunCodeAction = async (testClass: string) => {
  testClass = await resolveTestClassParam(testClass);
  if (isEmpty(testClass)) {
    // test param not provided: show error and terminate
    void notificationService.showErrorMessage(nls.localize('apex_test_run_codeAction_no_class_test_param_text'));
    return;
  }

  await apexTestRunCodeAction([testClass]);
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
      testMethod = apexTestRunCacheService.getLastMethodTestParam();
    }
  } else {
    await apexTestRunCacheService.setCachedMethodTestParam(testMethod);
  }

  return testMethod;
};

// invokes apex test run on a test method
export const apexTestMethodRunCodeAction = async (testMethod: string) => {
  testMethod = await resolveTestMethodParam(testMethod);
  if (isEmpty(testMethod)) {
    // test param not provided: show error and terminate
    void notificationService.showErrorMessage(nls.localize('apex_test_run_codeAction_no_method_test_param_text'));
    return;
  }

  await apexTestRunCodeAction([testMethod]);
};
