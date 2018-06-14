/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { sfdxCoreSettings } from '../settings';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

function isEmpty(value: string): boolean {
  return !value || value.length === 0;
}

function isNotEmpty(value: string): boolean {
  return !isEmpty(value);
}

// cache last test class and test method values to
// enable re-running w/o command context via built-in LRU
class ForceApexTestRunCacheService {
  public lastClassTestParam: string;
  public lastMethodTestParam: string;
  private static instance: ForceApexTestRunCacheService;

  public static getInstance() {
    if (!ForceApexTestRunCacheService.instance) {
      ForceApexTestRunCacheService.instance = new ForceApexTestRunCacheService();
    }
    return ForceApexTestRunCacheService.instance;
  }

  public constructor() {
    this.lastClassTestParam = '';
    this.lastMethodTestParam = '';
  }

  public hasCachedClassTestParam() {
    return isNotEmpty(this.lastClassTestParam);
  }

  public hasCachedMethodTestParam() {
    return isNotEmpty(this.lastMethodTestParam);
  }
}

const forceApexTestRunCacheService = ForceApexTestRunCacheService.getInstance();

// build force:apex:test:run w/ given test class or test method
export class ForceApexTestRunCodeActionExecutor extends SfdxCommandletExecutor<{}> {
  private test: string;
  private shouldGetCodeCoverage: boolean = false;
  private builder: SfdxCommandBuilder = new SfdxCommandBuilder();

  public constructor(test: string, shouldGetCodeCoverage: boolean) {
    super();
    this.test = test || '';
    this.shouldGetCodeCoverage = shouldGetCodeCoverage;
  }

  public build(data: {}): Command {
    this.builder = this.builder
      .withDescription(
        nls.localize('force_apex_test_run_codeAction_description_text')
      )
      .withArg('force:apex:test:run')
      .withFlag('--tests', this.test)
      .withFlag('--resultformat', 'human')
      .withArg('--synchronous')
      .withFlag('--loglevel', 'error');

    if (this.shouldGetCodeCoverage) {
      this.builder = this.builder.withArg('--codecoverage');
    }

    return this.builder.build();
  }
}

async function forceApexTestRunCodeAction(test: string) {
  const getCodeCoverage: boolean = sfdxCoreSettings
    .getConfiguration()
    .get('retrieve-test-code-coverage') as boolean;
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new EmptyParametersGatherer(),
    new ForceApexTestRunCodeActionExecutor(test, getCodeCoverage)
  );
  await commandlet.run();
}

//   T E S T   C L A S S

// redirects to run-all-tests cmd
export async function forceApexTestClassRunCodeActionDelegate(
  testClass: string
) {
  // enable then run 'last executed' command so command
  // added to 'recently used'
  await vscode.commands.executeCommand(
    'setContext',
    'sfdx:has_cached_test_class',
    true
  );

  vscode.commands.executeCommand('sfdx.force.apex.test.class.run', testClass);
}

// evaluate test class param: if not provided, apply cached value
// exported for testability
export function resolveTestClassParam(testClass: string): string {
  if (isEmpty(testClass)) {
    // value not provided for re-run invocations
    // apply cached value, if available
    if (forceApexTestRunCacheService.hasCachedClassTestParam()) {
      testClass = forceApexTestRunCacheService.lastClassTestParam;
    }
  } else {
    forceApexTestRunCacheService.lastClassTestParam = testClass;
  }

  return testClass;
}

// invokes apex test run on all tests in a class
export async function forceApexTestClassRunCodeAction(testClass: string) {
  testClass = resolveTestClassParam(testClass);
  if (isEmpty(testClass)) {
    // test param not provided: show error and terminate
    notificationService.showErrorMessage(
      nls.localize('force_apex_test_run_codeAction_no_class_test_param_text')
    );
    return;
  }

  await forceApexTestRunCodeAction(testClass);
}

//   T E S T   M E T H O D

// redirects to run-test-method cmd
export async function forceApexTestMethodRunCodeActionDelegate(
  testMethod: string
) {
  // enable then run 'last executed' command so command
  // added to 'recently used'
  await vscode.commands.executeCommand(
    'setContext',
    'sfdx:has_cached_test_method',
    true
  );

  vscode.commands.executeCommand('sfdx.force.apex.test.method.run', testMethod);
}

// evaluate test method param: if not provided, apply cached value
// exported for testability
export function resolveTestMethodParam(testMethod: string): string {
  if (isEmpty(testMethod)) {
    // value not provided for re-run invocations
    // apply cached value, if available
    if (forceApexTestRunCacheService.hasCachedMethodTestParam()) {
      testMethod = forceApexTestRunCacheService.lastMethodTestParam;
    }
  } else {
    forceApexTestRunCacheService.lastMethodTestParam = testMethod;
  }

  return testMethod;
}

// invokes apex test run on a test method
export async function forceApexTestMethodRunCodeAction(testMethod: string) {
  testMethod = resolveTestMethodParam(testMethod);
  if (isEmpty(testMethod)) {
    // test param not provided: show error and terminate
    notificationService.showErrorMessage(
      nls.localize('force_apex_test_run_codeAction_no_method_test_param_text')
    );
    return;
  }

  await forceApexTestRunCodeAction(testMethod);
}
