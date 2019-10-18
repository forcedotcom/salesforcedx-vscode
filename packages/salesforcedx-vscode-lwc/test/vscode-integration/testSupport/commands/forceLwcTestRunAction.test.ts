/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import Uri from 'vscode-uri';
import { ForceLwcTestRunCodeActionExecutor } from '../../../../src/testSupport/commands/forceLwcTestRunAction';
import {
  TestCaseInfo,
  TestInfoKind,
  TestType
} from '../../../../src/testSupport/types';

describe('Force LWC Test Run - Code Action', () => {
  describe('Command builder - Test Case', () => {
    const root = /^win32/.test(process.platform) ? 'C:\\' : '/var';
    const sfdxProjectPath = path.join(root, 'project', 'mockSfdxProject');
    const testFsPath = path.join(
      sfdxProjectPath,
      'force-app',
      'main',
      'default',
      'lwc',
      'mockComponent',
      '__tests__',
      'mockTest.test.js'
    );

    it('Should build command for single test case', () => {
      const testName = 'mockTestName';
      const testUri = Uri.file(testFsPath);
      const testExecutionInfo: TestCaseInfo = {
        kind: TestInfoKind.TEST_CASE,
        testType: TestType.LWC,
        testUri,
        testName
      };
      const builder = new ForceLwcTestRunCodeActionExecutor(
        sfdxProjectPath,
        testExecutionInfo
      );
      const command = builder.build({});
      if (/^win32/.test(process.platform)) {
        expect(command.toCommand()).to.equal(
          'C:\\project\\mockSfdxProject\\node_modules\\.bin\\lwc-jest -- --runTestsByPath force-app\\main\\default\\lwc\\mockComponent\\__tests__\\mockTest.test.js --testNamePattern "mockTestName"'
        );
      } else {
        expect(command.toCommand()).to.equal(
          '/var/project/mockSfdxProject/node_modules/.bin/lwc-jest -- --runTestsByPath /var/project/mockSfdxProject/force-app/main/default/lwc/mockComponent/__tests__/mockTest.test.js --testNamePattern "mockTestName"'
        );
      }
    });

    it('Should build command for single test case and escape test name for regex', () => {
      const testName = 'mockTestName (+.*)';
      const testUri = Uri.file(testFsPath);
      const testExecutionInfo: TestCaseInfo = {
        kind: TestInfoKind.TEST_CASE,
        testType: TestType.LWC,
        testUri,
        testName
      };
      const builder = new ForceLwcTestRunCodeActionExecutor(
        sfdxProjectPath,
        testExecutionInfo
      );
      const command = builder.build({});
      const escapedMockTestName = 'mockTestName \\(\\+\\.\\*\\)';
      if (/^win32/.test(process.platform)) {
        expect(command.toCommand()).to.equal(
          `C:\\project\\mockSfdxProject\\node_modules\\.bin\\lwc-jest -- --runTestsByPath force-app\\main\\default\\lwc\\mockComponent\\__tests__\\mockTest.test.js --testNamePattern "${escapedMockTestName}"`
        );
      } else {
        expect(command.toCommand()).to.equal(
          `/var/project/mockSfdxProject/node_modules/.bin/lwc-jest -- --runTestsByPath /var/project/mockSfdxProject/force-app/main/default/lwc/mockComponent/__tests__/mockTest.test.js --testNamePattern "${escapedMockTestName}"`
        );
      }
    });
  });
});
