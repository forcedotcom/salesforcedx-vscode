/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getTestNamePatternArgs } from '../../../../src/testSupport/testRunner/testRunner';
import { TestCaseInfo, TestFileInfo, TestInfoKind, TestType } from '../../../../src/testSupport/types';
import { Uri } from 'vscode';
import * as path from 'path';

describe('testRunner Unit Tests.', () => {
  const mockUriPath = path.join('/');
  const mockURI = {
    fsPath: mockUriPath
  } as Uri;

  describe('test getTestNamePatternArgs', () => {
    it('Should return testNamePattern if flag is included', async () => {
      const testName = 'Testing is Fun!';
      const testExecutionInfo: TestCaseInfo = {
        kind: TestInfoKind.TEST_CASE,
        testType: TestType.LWC,
        testUri: mockURI,
        testName
      };
      const testPatternArgs = getTestNamePatternArgs(testExecutionInfo);
      expect(testPatternArgs.length).toEqual(2);
      expect(testPatternArgs).toContain('--testNamePattern');
      expect(testPatternArgs).toContain(testName);
    });
    it('Should escape certain symbols if testNamePattern is included', async () => {
      const testName = 'Test ?$^*().[]{}|+ Symbols';
      const testNameEscaped = 'Test \\?\\$\\^\\*\\(\\)\\.\\[\\]\\{\\}\\|\\+ Symbols';
      const testExecutionInfo: TestCaseInfo = {
        kind: TestInfoKind.TEST_CASE,
        testType: TestType.LWC,
        testUri: mockURI,
        testName
      };
      const testPatternArgs = getTestNamePatternArgs(testExecutionInfo);
      expect(testPatternArgs).toContain(testNameEscaped);
    });
    it('Should not escape certain symbols if testNamePattern is included', async () => {
      const testName = 'Test !@#"%&;:,<>\=~` Symbols';
      const testExecutionInfo: TestCaseInfo = {
        kind: TestInfoKind.TEST_CASE,
        testType: TestType.LWC,
        testUri: mockURI,
        testName
      };
      const testPatternArgs = getTestNamePatternArgs(testExecutionInfo);
      expect(testPatternArgs).toContain(testName);
    });
    it('Should return empty array if testName is omitted', async () => {
      const testExecutionInfo: TestFileInfo = {
        kind: TestInfoKind.TEST_FILE,
        testType: TestType.LWC,
        testUri: mockURI
      };
      const testPatternArgs = getTestNamePatternArgs(testExecutionInfo);
      expect(testPatternArgs).toHaveLength(0);
    });

  });
});