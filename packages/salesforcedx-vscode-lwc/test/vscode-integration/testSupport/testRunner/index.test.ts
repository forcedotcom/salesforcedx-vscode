/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestRunner as UtilsTestRunner } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/';
import { expect } from 'chai';
import * as path from 'path';
import { assert, SinonStub, stub, SinonSpy, spy } from 'sinon';
import * as uuid from 'uuid';
import * as vscode from 'vscode';

import URI from 'vscode-uri';
import {
  TestCaseInfo,
  TestInfoKind,
  TestType
} from '../../../../src/testSupport/types';

import {
  TestRunner,
  TestRunType
} from '../../../../src/testSupport/testRunner';
import { InputBuffer } from 'uuid/interfaces';

describe('LWC Test Runner', () => {
  describe('Jest Execution Info Unit Tests', () => {
    let uuidStub: SinonStub<
      [({ random: InputBuffer } | { rng(): InputBuffer } | undefined)?],
      string
    >;
    let getTempFolderStub: SinonStub<[string, string], string>;
    beforeEach(() => {
      uuidStub = stub(uuid, 'v4');
      const mockUuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      uuidStub.returns(mockUuid);
      getTempFolderStub = stub(UtilsTestRunner.prototype, 'getTempFolder');
      getTempFolderStub.callsFake((vscodePath: string, testType: string) => {
        return path.join(vscodePath, '.sfdx', 'tools', 'testresults', testType);
      });
    });
    afterEach(() => {
      uuidStub.restore();
      getTempFolderStub.restore();
    });

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
    const mockWorkspaceFolder = { uri: URI.file(sfdxProjectPath) };
    it('Should get jest execution info for test case', () => {
      const testName = 'mockTestName';
      const testUri = URI.file(testFsPath);
      const testExecutionInfo: TestCaseInfo = {
        kind: TestInfoKind.TEST_CASE,
        testType: TestType.LWC,
        testUri,
        testName
      };
      const jestExecutionInfo = new TestRunner(
        testExecutionInfo,
        TestRunType.RUN
      ).getJestExecutionInfo(mockWorkspaceFolder as vscode.WorkspaceFolder);
      if (/^win32/.test(process.platform)) {
        expect(jestExecutionInfo!.jestArgs).to.eql([
          '--json',
          '--outputFile',
          'c:\\project\\mockSfdxProject\\.sfdx\\tools\\testresults\\lwc\\test-result-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.json',
          '--testLocationInResults',
          '--runTestsByPath',
          'force-app\\main\\default\\lwc\\mockComponent\\__tests__\\mockTest.test.js',
          '--testNamePattern',
          '"mockTestName"'
        ]);
      } else {
        expect(jestExecutionInfo!.jestArgs).to.eql([
          '--json',
          '--outputFile',
          '/var/project/mockSfdxProject/.sfdx/tools/testresults/lwc/test-result-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.json',
          '--testLocationInResults',
          '--runTestsByPath',
          '/var/project/mockSfdxProject/force-app/main/default/lwc/mockComponent/__tests__/mockTest.test.js',
          '--testNamePattern',
          '"mockTestName"'
        ]);
      }
    });

    it('Should get jest execution info for test case with special characters', () => {
      const testName = 'mockTestName (+.*)';
      const testUri = URI.file(testFsPath);
      const testExecutionInfo: TestCaseInfo = {
        kind: TestInfoKind.TEST_CASE,
        testType: TestType.LWC,
        testUri,
        testName
      };
      const jestExecutionInfo = new TestRunner(
        testExecutionInfo,
        TestRunType.RUN
      ).getJestExecutionInfo(mockWorkspaceFolder as vscode.WorkspaceFolder);
      const escapedMockTestName = 'mockTestName \\(\\+\\.\\*\\)';
      if (/^win32/.test(process.platform)) {
        expect(jestExecutionInfo!.jestArgs).to.eql([
          '--json',
          '--outputFile',
          'c:\\project\\mockSfdxProject\\.sfdx\\tools\\testresults\\lwc\\test-result-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.json',
          '--testLocationInResults',
          '--runTestsByPath',
          'force-app\\main\\default\\lwc\\mockComponent\\__tests__\\mockTest.test.js',
          '--testNamePattern',
          `"${escapedMockTestName}"`
        ]);
      } else {
        expect(jestExecutionInfo!.jestArgs).to.eql([
          '--json',
          '--outputFile',
          '/var/project/mockSfdxProject/.sfdx/tools/testresults/lwc/test-result-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.json',
          '--testLocationInResults',
          '--runTestsByPath',
          '/var/project/mockSfdxProject/force-app/main/default/lwc/mockComponent/__tests__/mockTest.test.js',
          '--testNamePattern',
          `"${escapedMockTestName}"`
        ]);
      }
    });
  });
});
