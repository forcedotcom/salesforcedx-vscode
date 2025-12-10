/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AsyncTestConfiguration, AsyncTestArrayConfiguration, TestLevel, TestService } from '@salesforce/apex-node';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { extractSuiteName, isSuite } from './testItemUtils';

interface PayloadBuildResult {
  payload: AsyncTestConfiguration | AsyncTestArrayConfiguration;
  hasSuite: boolean;
  hasClass: boolean;
}

/**
 * Builds a test execution payload based on the tests to run
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

  // Determine what type of run this is based on testsToRun
  const suiteItem = testsToRun.find(item => isSuite(item.id));
  if (suiteItem) {
    // Running a suite
    hasSuite = true;
    const suiteName = extractSuiteName(suiteItem.id);
    if (!suiteName) {
      throw new Error(nls.localize('apex_test_suite_name_not_determined_message'));
    }
    payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      undefined,
      suiteName,
      undefined,
      !codeCoverage
    );
  } else {
    // Running classes or methods
    const methodNames = testNames.filter(name => name.includes('.'));
    const classNames = testNames.filter(name => !name.includes('.'));

    if (classNames.length > 0) {
      // Running entire classes - use class name parameter
      hasClass = true;
      // Note: buildAsyncPayload only supports one class at a time
      payload = await testService.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        undefined,
        classNames[0],
        undefined,
        undefined,
        !codeCoverage
      );
    } else if (methodNames.length > 0) {
      // Check if all methods belong to the same class
      const classes = new Set(methodNames.map(name => name.split('.')[0]));
      if (classes.size === 1) {
        // All methods from same class - use class name parameter for efficiency
        hasClass = true;
        const className = Array.from(classes)[0];
        payload = await testService.buildAsyncPayload(
          TestLevel.RunSpecifiedTests,
          undefined,
          className,
          undefined,
          undefined,
          !codeCoverage
        );
      } else {
        // Multiple classes - use method names
        payload = await testService.buildAsyncPayload(
          TestLevel.RunSpecifiedTests,
          methodNames.join(','),
          undefined,
          undefined,
          undefined,
          !codeCoverage
        );
      }
    }
  }

  if (!payload) {
    throw new Error(nls.localize('apex_test_payload_build_failed_message'));
  }

  return {
    payload,
    hasSuite,
    hasClass
  };
};
