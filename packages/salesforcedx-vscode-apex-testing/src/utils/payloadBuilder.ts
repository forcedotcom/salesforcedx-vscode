/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AsyncTestConfiguration, AsyncTestArrayConfiguration, TestLevel, TestService } from '@salesforce/apex-node';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { PayloadBuildError, SuiteNameUnresolvedError } from '../views/apexTestExecutionErrors';
import { extractSuiteName, getTestName, isMethod, isSuite } from './testItemUtils';

type PayloadBuildResult = {
  payload: AsyncTestConfiguration | AsyncTestArrayConfiguration;
  hasSuite: boolean;
  hasClass: boolean;
};

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
 * Fails with SuiteNameUnresolvedError (no resolvable suite name) or PayloadBuildError (no payload produced).
 */
export const buildTestPayload = Effect.fn('buildTestPayload')(function* (
  testService: TestService,
  testsToRun: vscode.TestItem[],
  testNames: string[],
  codeCoverage: boolean
) {
  const skipCodeCoverage = !codeCoverage;

  const suites = testsToRun.filter(item => isSuite(item.id));
  const allSuites = suites.length > 0 && suites.length === testsToRun.length;

  if (allSuites) {
    const suiteNames = suites.map(item => extractSuiteName(item.id)).filter((name): name is string => !!name);
    if (suiteNames.length === 0) {
      return yield* new SuiteNameUnresolvedError({
        message: nls.localize('apex_test_suite_name_not_determined_message')
      });
    }
    const suiteParam = suiteNames.length === 1 ? suiteNames[0] : suiteNames.join(',');
    const payload = yield* Effect.promise(() => buildPayload(testService, { suiteName: suiteParam }, skipCodeCoverage));
    return { payload, hasSuite: true, hasClass: false } satisfies PayloadBuildResult;
  }

  const methodNames = testsToRun.filter(item => isMethod(item.id)).map(item => getTestName(item));

  const built = yield* Effect.promise(
    async (): Promise<{ payload?: PayloadBuildResult['payload']; hasClass: boolean }> => {
      if (methodNames.length > 0) {
        return {
          payload: await buildPayload(testService, { methods: methodNames.join(',') }, skipCodeCoverage),
          hasClass: false
        };
      }
      const classNames = testNames.filter(name => {
        const matchingItem = testsToRun.find(item => getTestName(item) === name);
        return !matchingItem || !isSuite(matchingItem.id);
      });
      if (classNames.length > 0) {
        const hasClass = classNames.length === 1;
        const classParam = hasClass ? classNames[0] : classNames.join(',');
        return { payload: await buildPayload(testService, { className: classParam }, skipCodeCoverage), hasClass };
      }
      return { hasClass: false };
    }
  );

  if (!built.payload) {
    return yield* new PayloadBuildError({ message: nls.localize('apex_test_payload_build_failed_message') });
  }
  return { payload: built.payload, hasSuite: false, hasClass: built.hasClass } satisfies PayloadBuildResult;
});
