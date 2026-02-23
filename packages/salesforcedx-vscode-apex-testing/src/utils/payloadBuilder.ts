/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AsyncTestConfiguration, AsyncTestArrayConfiguration, TestLevel, TestService } from '@salesforce/apex-node';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { extractSuiteName, getTestName, isMethod, isSuite } from './testItemUtils';

interface PayloadBuildResult {
  payload: AsyncTestConfiguration | AsyncTestArrayConfiguration;
  hasSuite: boolean;
  hasClass: boolean;
}

const buildPayload = (
  testService: TestService,
  options: { methods?: string; className?: string; suiteName?: string },
  skipCodeCoverage: boolean
) =>
  testService.buildAsyncPayload(
    TestLevel.RunSpecifiedTests,
    options.methods,
    options.className,
    options.suiteName,
    undefined,
    skipCodeCoverage
  );

/**
 * Builds a test execution payload based on the tests to run.
 * Delegates to TestService.buildAsyncPayload which correctly handles namespaces.
 */
export const buildTestPayload = async (
  testService: TestService,
  testsToRun: vscode.TestItem[],
  testNames: string[],
  codeCoverage: boolean
): Promise<PayloadBuildResult> => {
  let payload: AsyncTestConfiguration | AsyncTestArrayConfiguration | undefined;
  let hasSuite = false;
  let hasClass = false;
  const skipCodeCoverage = !codeCoverage;

  const suiteItems = testsToRun.filter(item => isSuite(item.id));
  const allSuites = suiteItems.length > 0 && suiteItems.length === testsToRun.length;

  if (allSuites) {
    hasSuite = true;
    const suiteNames = suiteItems.map(item => extractSuiteName(item.id)).filter((name): name is string => !!name);
    if (suiteNames.length === 0) {
      throw new Error(nls.localize('apex_test_suite_name_not_determined_message'));
    }
    const suiteParam = suiteNames.length === 1 ? suiteNames[0] : suiteNames.join(',');
    payload = await buildPayload(testService, { suiteName: suiteParam }, skipCodeCoverage);
    return { payload, hasSuite, hasClass };
  }

  const methodNames = testsToRun.filter(item => isMethod(item.id)).map(item => getTestName(item));

  if (methodNames.length > 0) {
    payload = await buildPayload(testService, { methods: methodNames.join(',') }, skipCodeCoverage);
  } else if (testNames.length > 0) {
    const classNames = testNames.filter(name => {
      const matchingItem = testsToRun.find(item => getTestName(item) === name);
      return !matchingItem || !isSuite(matchingItem.id);
    });
    if (classNames.length > 0) {
      hasClass = classNames.length === 1;
      const classParam = classNames.length === 1 ? classNames[0] : classNames.join(',');
      payload = await buildPayload(testService, { className: classParam }, skipCodeCoverage);
    }
  }

  if (!payload) {
    throw new Error(nls.localize('apex_test_payload_build_failed_message'));
  }
  return { payload, hasSuite, hasClass };
};
