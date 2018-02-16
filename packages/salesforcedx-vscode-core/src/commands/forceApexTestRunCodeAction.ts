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
import { nls } from '../messages';
import { notificationService } from '../notifications';
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
class ForceApexTestRunCache {
  public lastClassTestParam: string;
  public lastMethodTestParam: string;
  private static instance: ForceApexTestRunCache;

  public static getInstance() {
    if (!ForceApexTestRunCache.instance) {
      ForceApexTestRunCache.instance = new ForceApexTestRunCache();
    }
    return ForceApexTestRunCache.instance;
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

// build force:apex:test:run w/ given test class or test method
export class ForceApexTestRunCodeActionExecutor extends SfdxCommandletExecutor<{}> {
  private test: string;

  public constructor(test: string) {
    super();
    this.test = test || '';
  }

  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('force_apex_test_run_codeAction_description_text')
      )
      .withArg('force:apex:test:run')
      .withFlag('--tests', this.test)
      .withFlag('--resultformat', 'human')
      .withArg('--synchronous')
      .withFlag('--loglevel', 'error')
      .build();
  }
}

function forceApexTestRunCodeAction(test: string) {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new EmptyParametersGatherer(),
    new ForceApexTestRunCodeActionExecutor(test)
  );
  commandlet.run();
}

//   T E S T   C L A S S

// evaluate test class param: if not provided, apply cached value
// exported for testability
export function resolveTestClassParam(testClass: string): string {
  const testCache = ForceApexTestRunCache.getInstance();
  if (isEmpty(testClass)) {
    // value not provided for re-run invocations
    // apply cached value, if available
    if (testCache.hasCachedClassTestParam()) {
      testClass = testCache.lastClassTestParam;
    }
  } else {
    testCache.lastClassTestParam = testClass;
  }

  return testClass;
}

// invokes apex test run on all tests in a class
export function forceApexTestClassRunCodeAction(testClass: string) {
  testClass = resolveTestClassParam(testClass);
  if (isEmpty(testClass)) {
    // test param not provided: show error and terminate
    notificationService.showErrorMessage(
      nls.localize('force_apex_test_run_codeAction_no_class_test_param_text')
    );
    return;
  }

  forceApexTestRunCodeAction(testClass);
}

//   T E S T   M E T H O D

// evaluate test method param: if not provided, apply cached value
// exported for testability
export function resolveTestMethodParam(testMethod: string): string {
  const testCache = ForceApexTestRunCache.getInstance();
  if (isEmpty(testMethod)) {
    // value not provided for re-run invocations
    // apply cached value, if available
    if (testCache.hasCachedMethodTestParam()) {
      testMethod = testCache.lastMethodTestParam;
    }
  } else {
    testCache.lastMethodTestParam = testMethod;
  }

  return testMethod;
}

// invokes apex test run on a test method
export function forceApexTestMethodRunCodeAction(testMethod: string) {
  testMethod = resolveTestMethodParam(testMethod);
  if (isEmpty(testMethod)) {
    // test param not provided: show error and terminate
    notificationService.showErrorMessage(
      nls.localize('force_apex_test_run_codeAction_no_method_test_param_text')
    );
    return;
  }

  forceApexTestRunCodeAction(testMethod);
}
