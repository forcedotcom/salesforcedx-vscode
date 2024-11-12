/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { Uri } from 'vscode';
import { isTestCaseInfo, TestCaseInfo, TestFileInfo, TestInfoKind, TestType } from '../../../../src/testSupport/types';

describe('test support types Unit Tests.', () => {
  const mockUriPath = path.join('/');
  const mockURI = {
    fsPath: mockUriPath
  } as Uri;
  describe('test isTestCase', () => {
    it('Should return true for a TestCase', async () => {
      const testName = 'Testing is Fun!';
      const testExecutionInfo: TestCaseInfo = {
        kind: TestInfoKind.TEST_CASE,
        testType: TestType.LWC,
        testUri: mockURI,
        testName
      };
      expect(isTestCaseInfo(testExecutionInfo)).toBeTruthy();
    });
    it('Should return false for a TestFile', async () => {
      const testExecutionInfo: TestFileInfo = {
        kind: TestInfoKind.TEST_FILE,
        testType: TestType.LWC,
        testUri: mockURI
      };
      expect(isTestCaseInfo(testExecutionInfo)).toBeFalsy();
    });
  });
});
