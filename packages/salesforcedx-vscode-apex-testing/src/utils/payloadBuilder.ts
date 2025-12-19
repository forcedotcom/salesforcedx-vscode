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
  const suiteItems = testsToRun.filter(item => isSuite(item.id));
  if (suiteItems.length > 0) {
    // If we have multiple suites, we can't run them all at once with a single suite parameter
    // So we need to expand suites to their methods and use method names instead
    // OR if we have exactly one suite and no other tests, use the suite parameter
    if (suiteItems.length === 1 && testsToRun.length === 1) {
      // Single suite, no other tests - use suite parameter
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
    } else {
      // Multiple suites or mix of suites and other tests - fall through to method/class handling
      // The suite names will be filtered out from classNames below
      console.debug('[Payload Builder] Multiple suites or mixed suites/classes detected, using method names');
    }
  }

  // If we didn't create a payload yet (no single suite, or multiple suites), handle classes/methods
  if (!payload) {
    // Running classes or methods
    const methodNames = testNames.filter(name => name.includes('.'));
    // Filter out suite names from testNames - they should have been handled above, but just in case
    const suiteNames = new Set(
      testsToRun
        .filter(item => isSuite(item.id))
        .map(item => extractSuiteName(item.id))
        .filter((name): name is string => !!name)
    );
    // Also check testNames directly for suite names (in case they weren't filtered properly)
    const allSuiteNames = new Set([
      ...Array.from(suiteNames),
      ...testNames.filter(
        name => !name.includes('.') && testsToRun.some(item => isSuite(item.id) && extractSuiteName(item.id) === name)
      )
    ]);
    const classNames = testNames.filter(name => !name.includes('.') && !allSuiteNames.has(name));

    // If we have method names, ALWAYS use them to ensure only the selected methods run
    if (methodNames.length > 0) {
      console.debug('[Payload Builder] Building payload for methods:', methodNames.join(','));
      payload = await testService.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        methodNames.join(','),
        undefined,
        undefined,
        undefined,
        !codeCoverage
      );
    } else if (classNames.length > 0) {
      // Only class names, no method names
      if (classNames.length === 1) {
        // Single class - use class name parameter
        hasClass = true;
        console.debug('[Payload Builder] Building payload for single class:', classNames[0]);
        payload = await testService.buildAsyncPayload(
          TestLevel.RunSpecifiedTests,
          undefined,
          classNames[0],
          undefined,
          undefined,
          !codeCoverage
        );
      } else {
        // Multiple classes without method names - this shouldn't happen if gatherTests is working correctly
        // It should expand classes to methods, so this indicates an issue with test gathering
        throw new Error(
          `${nls.localize(
            'apex_test_payload_build_failed_message'
          )}: Multiple classes selected but no method names available`
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
