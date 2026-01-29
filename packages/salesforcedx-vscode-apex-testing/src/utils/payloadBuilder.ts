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

/**
 * Builds a test execution payload based on the tests to run.
 * For namespaced classes, constructs the payload manually to ensure the full
 * class name (Namespace.ClassName) is preserved in the className field.
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

  // Handle suite cases
  const suiteItems = testsToRun.filter(item => isSuite(item.id));
  if (suiteItems.length > 0 && suiteItems.length === testsToRun.length) {
    // All items are suites
    if (suiteItems.length === 1) {
      // Single suite - use suite parameter
      hasSuite = true;
      const suiteName = extractSuiteName(suiteItems[0].id);
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
      return { payload, hasSuite, hasClass };
    } else {
      // Multiple suites - extract suite names and build array payload
      // The API doesn't support multiple suites directly, so we use suiteNames parameter
      // which buildAsyncPayload will handle by running each suite
      hasSuite = true;
      const suiteNames = suiteItems.map(item => extractSuiteName(item.id)).filter((name): name is string => !!name);

      if (suiteNames.length === 0) {
        throw new Error(nls.localize('apex_test_suite_name_not_determined_message'));
      }

      // For multiple suites, pass comma-separated suite names
      payload = await testService.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        undefined,
        undefined,
        suiteNames.join(','),
        undefined,
        !codeCoverage
      );
      return { payload, hasSuite, hasClass };
    }
  }

  // Get method names by checking the test item IDs (not just by dot in name)
  const methodItems = testsToRun.filter(item => isMethod(item.id));
  const methodNames = methodItems.map(item => getTestName(item));

  if (methodNames.length > 0) {
    // Check if any method names are from namespaced classes (have 3+ parts like Namespace.Class.Method)
    const hasNamespacedMethods = methodNames.some(name => name.split('.').length > 2);

    if (hasNamespacedMethods) {
      // For namespaced classes, we must construct the payload manually because
      // buildAsyncPayload incorrectly parses "Namespace.Class.Method" and the API
      // rejects the resulting payload with className without namespace
      const methodsByClass = new Map<string, string[]>();
      for (const methodName of methodNames) {
        const parts = methodName.split('.');
        // For "Namespace.Class.Method" -> className = "Namespace.Class", method = "Method"
        // For "Class.Method" -> className = "Class", method = "Method"
        const method = parts.at(-1)!;
        const className = parts.slice(0, -1).join('.');

        const existingMethods = methodsByClass.get(className) ?? [];
        existingMethods.push(method);
        methodsByClass.set(className, existingMethods);
      }

      const tests = Array.from(methodsByClass.entries()).map(([className, methods]) => ({
        className,
        testMethods: methods
      }));

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      payload = {
        tests,
        testLevel: TestLevel.RunSpecifiedTests,
        skipCodeCoverage: !codeCoverage
      } as AsyncTestArrayConfiguration;
    } else {
      // No namespaced methods, use buildAsyncPayload as normal
      payload = await testService.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        methodNames.join(','),
        undefined,
        undefined,
        undefined,
        !codeCoverage
      );
    }
  } else if (testNames.length > 0) {
    // No method items - use class names
    // Filter out any suite names that might be in testNames
    const classNames = testNames.filter(name => {
      const matchingItem = testsToRun.find(item => getTestName(item) === name);
      return !matchingItem || !isSuite(matchingItem.id);
    });

    if (classNames.length === 1) {
      // Single class - use class parameter
      hasClass = true;
      payload = await testService.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        undefined,
        classNames[0],
        undefined,
        undefined,
        !codeCoverage
      );
    } else if (classNames.length > 1) {
      // Multiple classes - build array payload manually
      const tests: { className: string; testMethods: string[] }[] = classNames.map(className => ({
        className,
        testMethods: []
      }));

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      payload = {
        tests,
        testLevel: TestLevel.RunSpecifiedTests,
        skipCodeCoverage: !codeCoverage
      } as AsyncTestArrayConfiguration;
    }
  }

  if (!payload) {
    throw new Error(nls.localize('apex_test_payload_build_failed_message'));
  }

  return { payload, hasSuite, hasClass };
};
