/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { assert, SinonStub, stub } from 'sinon';
import * as uuid from 'uuid';
import * as vscode from 'vscode';
import URI from 'vscode-uri';
import { telemetryService } from '../../../../src/telemetry';
import {
  lwcTestCaseDebug,
  lwcTestDebugActiveTextEditorTest,
  lwcTestFileDebug,
  getDebugConfiguration,
  handleDidStartDebugSession,
  handleDidTerminateDebugSession
} from '../../../../src/testSupport/commands/lwcTestDebugAction';
import { workspace } from '../../../../src/testSupport/workspace';
import {
  TestCaseInfo,
  TestInfoKind,
  TestType
} from '../../../../src/testSupport/types';
import { LWC_TEST_DEBUG_LOG_NAME } from '../../../../src/testSupport/types/constants';
import {
  createMockTestFileInfo,
  mockActiveTextEditorUri,
  mockTestResultWatcher,
  unmockActiveTextEditorUri,
  unmockTestResultWatcher
} from '../mocks';
import { InputBuffer } from 'uuid/interfaces';
import { projectPaths } from '@salesforce/salesforcedx-utils-vscode';

describe('LWC Test Debug - Code Action', () => {
  let uuidStub: SinonStub<
    [({ random: InputBuffer } | { rng(): InputBuffer } | undefined)?],
    string
  >;
  let debugStub: SinonStub<
    [
      vscode.WorkspaceFolder | undefined,
      string | vscode.DebugConfiguration,
      (vscode.DebugSession | vscode.DebugSessionOptions | undefined)?
    ],
    Thenable<any>
  >;
  let getLwcTestRunnerExecutableStub: SinonStub<
    [string],
    fs.PathLike | undefined
  >;
  let processHrtimeStub: SinonStub<
    [([number, number] | undefined)?],
    [number, number]
  >;
  let telemetryStub: SinonStub<
    [(string | undefined)?, ([number, number] | undefined)?, any?, any?],
    void
  >;
  const mockUuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  beforeEach(() => {
    uuidStub = stub(uuid, 'v4');
    debugStub = stub(vscode.debug, 'startDebugging');
    processHrtimeStub = stub(process, 'hrtime');
    telemetryStub = stub(telemetryService, 'sendCommandEvent');
    getLwcTestRunnerExecutableStub = stub(
      workspace,
      'getLwcTestRunnerExecutable'
    );
    uuidStub.returns(mockUuid);
    debugStub.returns(Promise.resolve());
  });

  afterEach(() => {
    uuidStub.restore();
    debugStub.restore();
    processHrtimeStub.restore();
    telemetryStub.restore();
    getLwcTestRunnerExecutableStub.restore();
  });

  const root = /^win32/.test(process.platform) ? 'C:\\' : '/var';
  const salesforceProjectPath = path.join(
    root,
    'project',
    'mockSalesforceProject'
  );
  const lwcTestExecutablePath = path.join(
    salesforceProjectPath,
    'node_modules',
    '.bin',
    'lwc-jest'
  );
  const testRelativePath = path.join(
    'force-app',
    'main',
    'default',
    'lwc',
    'mockComponent',
    '__tests__',
    'mockTest.test.js'
  );
  const testFsPath = path.join(salesforceProjectPath, testRelativePath);
  const testName = 'mockTestName';
  const testUri = URI.file(testFsPath);
  const testExecutionInfo: TestCaseInfo = {
    kind: TestInfoKind.TEST_CASE,
    testType: TestType.LWC,
    testUri,
    testName
  };

  describe('Debug Configuration', () => {
    const command = lwcTestExecutablePath;
    const args = [
      '--debug',
      '--',
      '--runTestsByPath',
      /^win32/.test(process.platform) ? testRelativePath : testFsPath,
      '--testNamePattern',
      'mockTestName'
    ];
    const cwd = salesforceProjectPath;

    it('Should generate debug configuration for single test case', () => {
      const debugConfiguration = getDebugConfiguration(command, args, cwd);
      expect(debugConfiguration).to.deep.equal({
        sfDebugSessionId: mockUuid,
        type: 'node',
        request: 'launch',
        name: 'Debug LWC test(s)',
        cwd: salesforceProjectPath,
        runtimeExecutable: lwcTestExecutablePath,
        args,
        resolveSourceMapLocations: ['**', '!**/node_modules/**'],
        console: 'integratedTerminal',
        internalConsoleOptions: 'openOnSessionStart',
        port: 9229,
        disableOptimisticBPs: true
      });
    });

    it('Should send telemetry for debug test case', async () => {
      getLwcTestRunnerExecutableStub.returns(lwcTestExecutablePath);
      const mockExecutionTime: [number, number] = [123, 456];
      processHrtimeStub.returns(mockExecutionTime);
      const debugConfiguration = getDebugConfiguration(command, args, cwd);
      await lwcTestCaseDebug({
        testExecutionInfo
      });
      const mockDebugSession: vscode.DebugSession = {
        id: 'mockId',
        type: 'node',
        name: debugConfiguration.name,
        workspaceFolder: debugConfiguration.cwd,
        configuration: debugConfiguration,
        customRequest: (cmd: string) => Promise.resolve(),
        getDebugProtocolBreakpoint: breakpoint => Promise.resolve(undefined)
      };
      handleDidStartDebugSession(mockDebugSession);
      handleDidTerminateDebugSession(mockDebugSession);
      assert.calledOnce(telemetryStub);
      assert.calledWith(
        telemetryStub,
        LWC_TEST_DEBUG_LOG_NAME,
        mockExecutionTime,
        {
          workspaceType: 'SFDX'
        }
      );
    });
  });

  describe('Debug Test File', () => {
    beforeEach(() => {
      getLwcTestRunnerExecutableStub.returns(lwcTestExecutablePath);
      mockTestResultWatcher();
    });
    afterEach(() => {
      unmockTestResultWatcher();
    });

    const mockTestFileInfo = createMockTestFileInfo();
    it('Should debug test file', async () => {
      await lwcTestFileDebug({
        testExecutionInfo: mockTestFileInfo
      });
      const expectedCwd = vscode.workspace.workspaceFolders![0].uri.fsPath;
      const expectedArgTwo = {
        args: [
          '--',
          '--json',
          '--outputFile',
          path.join(
            projectPaths.lwcTestResultsFolder(),
            `test-result-${mockUuid}.json`
          ),
          '--testLocationInResults',
          '--runTestsByPath',
          /^win32/.test(process.platform)
            ? path.relative(expectedCwd, mockTestFileInfo.testUri.fsPath)
            : mockTestFileInfo.testUri.fsPath
        ],
        resolveSourceMapLocations: ['**', '!**/node_modules/**'],
        console: 'integratedTerminal',
        cwd: expectedCwd,
        disableOptimisticBPs: true,
        internalConsoleOptions: 'openOnSessionStart',
        name: 'Debug LWC test(s)',
        port: 9229,
        request: 'launch',
        runtimeExecutable: lwcTestExecutablePath,
        sfDebugSessionId: mockUuid,
        type: 'node'
      };

      expect(getLwcTestRunnerExecutableStub.getCalls().length).to.equal(1);
      expect(debugStub.getCalls().length).to.equal(1);
      expect(debugStub.getCall(0).args[0]).to.equal(
        vscode.workspace.workspaceFolders![0]
      );
      expect(debugStub.getCall(0).args[1]).to.deep.equal(expectedArgTwo);
      assert.calledWith(
        debugStub,
        vscode.workspace.workspaceFolders![0],
        expectedArgTwo
      );
    });

    it('Should debug active text editor test file', async () => {
      mockActiveTextEditorUri(mockTestFileInfo.testUri);
      await lwcTestDebugActiveTextEditorTest();
      const expectedCwd = vscode.workspace.workspaceFolders![0].uri.fsPath;
      expect(getLwcTestRunnerExecutableStub.getCalls().length).to.equal(1);
      assert.calledWith(debugStub, vscode.workspace.workspaceFolders![0], {
        args: [
          '--',
          '--json',
          '--outputFile',
          path.join(
            projectPaths.lwcTestResultsFolder(),
            `test-result-${mockUuid}.json`
          ),
          '--testLocationInResults',
          '--runTestsByPath',
          /^win32/.test(process.platform)
            ? path.relative(expectedCwd, mockTestFileInfo.testUri.fsPath)
            : mockTestFileInfo.testUri.fsPath
        ],
        resolveSourceMapLocations: ['**', '!**/node_modules/**'],
        console: 'integratedTerminal',
        cwd: expectedCwd,
        disableOptimisticBPs: true,
        internalConsoleOptions: 'openOnSessionStart',
        name: 'Debug LWC test(s)',
        port: 9229,
        request: 'launch',
        runtimeExecutable: lwcTestExecutablePath,
        sfDebugSessionId: mockUuid,
        type: 'node'
      });
      unmockActiveTextEditorUri();
    });
  });
});
