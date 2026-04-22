/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { URI } from 'vscode-uri';
import { isTestCaseInfo, TestCaseInfo, TestFileInfo } from '../../../../src/testSupport/types';

describe('test support types Unit Tests.', () => {
  const mockUriPath = path.join('/');
  const mockURI = {
    fsPath: mockUriPath
  } as unknown as URI;
  describe('test isTestCase', () => {
    it('Should return true for a TestCase', () => {
      const testName = 'Testing is Fun!';
      const testExecutionInfo: TestCaseInfo = {
        kind: 'testCase',
        testUri: mockURI,
        testName
      };
      expect(isTestCaseInfo(testExecutionInfo)).toBeTruthy();
    });
    it('Should return false for a TestFile', () => {
      const testExecutionInfo: TestFileInfo = {
        kind: 'testFile',
        testUri: mockURI
      };
      expect(isTestCaseInfo(testExecutionInfo)).toBeFalsy();
    });
  });
});
