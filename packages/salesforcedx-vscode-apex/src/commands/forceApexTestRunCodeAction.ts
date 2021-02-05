/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  HumanReporter,
  TestItem,
  TestLevel,
  TestService
} from '@salesforce/apex-node';
import {
  LibraryCommandletExecutor,
  SfdxCommandletExecutor
} from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  Command,
  SfdxCommandBuilder,
  TestRunner
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { notificationService } from '@salesforce/salesforcedx-utils-vscode/out/src/commands';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../constants';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import { forceApexTestRunCacheService, isEmpty } from '../testRunCache';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const EmptyParametersGatherer = sfdxCoreExports.EmptyParametersGatherer;
const sfdxCoreSettings = sfdxCoreExports.sfdxCoreSettings;
const SfdxCommandlet = sfdxCoreExports.SfdxCommandlet;
const SfdxWorkspaceChecker = sfdxCoreExports.SfdxWorkspaceChecker;
const channelService = sfdxCoreExports.channelService;

export class ApexLibraryTestRunExecutor extends LibraryCommandletExecutor<{
  outputDir: string;
  tests: string[];
  codeCoverage: boolean;
}> {
  private tests: string[];
  private codeCoverage: boolean = false;
  private outputDir: string;

  public static diagnostics = vscode.languages.createDiagnosticCollection(
    'apex-errors'
  );

  constructor(tests: string[], outputDir: string, codeCoverage: boolean) {
    super(
      nls.localize('force_apex_test_run_text'),
      'force_apex_test_run_code_action_library',
      OUTPUT_CHANNEL
    );
    this.tests = tests;
    this.outputDir = outputDir;
    this.codeCoverage = codeCoverage;
  }

  private buildTestItem(testNames: string[]): TestItem[] {
    const tItems = testNames.map(item => {
      if (item.indexOf('.') > 0) {
        const splitItemData = item.split('.');
        return {
          className: splitItemData[0],
          testMethods: [splitItemData[1]]
        } as TestItem;
      }

      return { className: item } as TestItem;
    });
    return tItems;
  }

  public async run(): Promise<boolean> {
    const connection = await workspaceContext.getConnection();
    const testService = new TestService(connection);
    const result = await testService.runTestAsynchronous(
      {
        tests: this.buildTestItem(this.tests),
        testLevel: TestLevel.RunSpecifiedTests
      },
      this.codeCoverage
    );
    await testService.writeResultFiles(
      result,
      { resultFormat: 'json', dirPath: this.outputDir },
      this.codeCoverage
    );
    const humanOutput = new HumanReporter().format(result, this.codeCoverage);
    channelService.appendLine(humanOutput);
    return true;
  }
}

// build force:apex:test:run w/ given test class or test method
export class ForceApexTestRunCodeActionExecutor extends SfdxCommandletExecutor<{}> {
  protected tests: string;
  protected shouldGetCodeCoverage: boolean = false;
  protected builder: SfdxCommandBuilder = new SfdxCommandBuilder();
  private outputToJson: string;

  public constructor(
    tests: string[],
    shouldGetCodeCoverage: boolean,
    outputToJson: string
  ) {
    super(OUTPUT_CHANNEL);
    this.tests = tests.join(',') || '';
    this.shouldGetCodeCoverage = shouldGetCodeCoverage;
    this.outputToJson = outputToJson;
  }

  public build(data: {}): Command {
    this.builder = this.builder
      .withDescription(nls.localize('force_apex_test_run_text'))
      .withArg('force:apex:test:run')
      .withFlag('--tests', this.tests)
      .withFlag('--resultformat', 'human')
      .withFlag('--outputdir', this.outputToJson)
      .withFlag('--loglevel', 'error')
      .withLogName('force_apex_test_run_code_action');

    if (this.shouldGetCodeCoverage) {
      this.builder = this.builder.withArg('--codecoverage');
    }

    return this.builder.build();
  }
}

async function forceApexTestRunCodeAction(tests: string[]) {
  const outputToJson = getTempFolder();
  const getCodeCoverage = sfdxCoreSettings.getRetrieveTestCodeCoverage();
  const testRunExecutor = sfdxCoreSettings.getApexLibrary()
    ? new ApexLibraryTestRunExecutor(tests, outputToJson, getCodeCoverage)
    : new ForceApexTestRunCodeActionExecutor(
        tests,
        getCodeCoverage,
        outputToJson
      );
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new EmptyParametersGatherer(),
    testRunExecutor
  );
  await commandlet.run();
}

function getTempFolder(): string {
  if (vscode.workspace && vscode.workspace.workspaceFolders) {
    const apexDir = new TestRunner().getTempFolder(
      vscode.workspace.workspaceFolders[0].uri.fsPath,
      'apex'
    );
    return apexDir;
  } else {
    throw new Error(nls.localize('cannot_determine_workspace'));
  }
}

//   T E S T   C L A S S

// redirects to run-all-tests cmd
export async function forceApexTestClassRunCodeActionDelegate(
  testClass: string
) {
  vscode.commands.executeCommand('sfdx.force.apex.test.class.run', testClass);
}

export async function forceApexDebugClassRunCodeActionDelegate(
  testClass: string
) {
  vscode.commands.executeCommand('sfdx.force.test.view.debugTests', {
    name: testClass
  });
}

// evaluate test class param: if not provided, apply cached value
// exported for testability
export async function resolveTestClassParam(
  testClass: string
): Promise<string> {
  if (isEmpty(testClass)) {
    // value not provided for re-run invocations
    // apply cached value, if available
    if (forceApexTestRunCacheService.hasCachedClassTestParam()) {
      testClass = forceApexTestRunCacheService.getLastClassTestParam();
    }
  } else {
    await forceApexTestRunCacheService.setCachedClassTestParam(testClass);
  }
  return testClass;
}

// invokes apex test run on all tests in a class
export async function forceApexTestClassRunCodeAction(testClass: string) {
  testClass = await resolveTestClassParam(testClass);
  if (isEmpty(testClass)) {
    // test param not provided: show error and terminate
    notificationService.showErrorMessage(
      nls.localize('force_apex_test_run_codeAction_no_class_test_param_text')
    );
    return;
  }

  await forceApexTestRunCodeAction([testClass]);
}

//   T E S T   M E T H O D

// redirects to run-test-method cmd
export async function forceApexTestMethodRunCodeActionDelegate(
  testMethod: string
) {
  vscode.commands.executeCommand('sfdx.force.apex.test.method.run', testMethod);
}
export async function forceApexDebugMethodRunCodeActionDelegate(
  testMethod: string
) {
  vscode.commands.executeCommand('sfdx.force.test.view.debugSingleTest', {
    name: testMethod
  });
}

// evaluate test method param: if not provided, apply cached value
// exported for testability
export async function resolveTestMethodParam(
  testMethod: string
): Promise<string> {
  if (isEmpty(testMethod)) {
    // value not provided for re-run invocations
    // apply cached value, if available
    if (forceApexTestRunCacheService.hasCachedMethodTestParam()) {
      testMethod = forceApexTestRunCacheService.getLastMethodTestParam();
    }
  } else {
    await forceApexTestRunCacheService.setCachedMethodTestParam(testMethod);
  }

  return testMethod;
}

// invokes apex test run on a test method
export async function forceApexTestMethodRunCodeAction(testMethod: string) {
  testMethod = await resolveTestMethodParam(testMethod);
  if (isEmpty(testMethod)) {
    // test param not provided: show error and terminate
    notificationService.showErrorMessage(
      nls.localize('force_apex_test_run_codeAction_no_method_test_param_text')
    );
    return;
  }

  await forceApexTestRunCodeAction([testMethod]);
}
