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
  forceLwcTestCaseDebug,
  forceLwcTestDebugActiveTextEditorTest,
  forceLwcTestFileDebug,
  getDebugConfiguration,
  handleDidStartDebugSession,
  handleDidTerminateDebugSession
} from '../../../../src/testSupport/commands/forceLwcTestDebugAction';
import * as lwcTestWorkspace from '../../../../src/testSupport/workspace';
import {
  TestCaseInfo,
  TestInfoKind,
  TestType
} from '../../../../src/testSupport/types';
import { FORCE_LWC_TEST_DEBUG_LOG_NAME } from '../../../../src/testSupport/types/constants';
import {
  createMockTestFileInfo,
  mockActiveTextEditorUri,
  mockTestResultWatcher,
  unmockActiveTextEditorUri,
  unmockTestResultWatcher
} from '../mocks';
import { InputBuffer } from 'uuid/interfaces';

describe('Force LWC Test Debug - Code Action', () => {
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
  let getLwcTestRunnerExecutableStub: SinonStub<[string], fs.PathLike>;
  let processHrtimeStub: SinonStub<
    [([number, number] | undefined)?],
    [number, number]
  >;
  let telemetryStub: SinonStub<
    [(string | undefined)?, ([number, number] | undefined)?, any?],
    Promise<void>
  >;
  const mockUuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  beforeEach(() => {
    uuidStub = stub(uuid, 'v4');
    debugStub = stub(vscode.debug, 'startDebugging');
    processHrtimeStub = stub(process, 'hrtime');
    telemetryStub = stub(telemetryService, 'sendCommandEvent');
    getLwcTestRunnerExecutableStub = stub(
      lwcTestWorkspace,
      'getLwcTestRunnerExecutable'
    );
    uuidStub.returns(mockUuid);
    telemetryStub.returns(Promise.resolve());
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
  const sfdxProjectPath = path.join(root, 'project', 'mockSfdxProject');
  const lwcTestExecutablePath = path.join(
    sfdxProjectPath,
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
  const testFsPath = path.join(sfdxProjectPath, testRelativePath);
  const testName = 'mockTestName';
  const testUri = URI.file(testFsPath);
  const testExecutionInfo: TestCaseInfo = {
    kind: TestInfoKind.TEST_CASE,
    testType: TestType.LWC,
    testUri,
    testName
  };
  const command = lwcTestExecutablePath;
  const args = [
    '--debug',
    '--',
    '--runTestsByPath',
    /^win32/.test(process.platform) ? testRelativePath : testFsPath,
    '--testNamePattern',
    '"mockTestName"'
  ];
  const cwd = sfdxProjectPath;

  describe('Debug Configuration', () => {
    it('Should generate debug configuration for single test case', () => {
      const debugConfiguration = getDebugConfiguration(command, args, cwd);
      expect(debugConfiguration).to.deep.equal({
        sfdxDebugSessionId: mockUuid,
        type: 'node',
        request: 'launch',
        name: 'Debug LWC test(s)',
        cwd: sfdxProjectPath,
        runtimeExecutable: lwcTestExecutablePath,
        args,
        console: 'integratedTerminal',
        internalConsoleOptions: 'openOnSessionStart',
        port: 9229,
        disableOptimisticBPs: true
      });
    });
  });

  describe('Debug Test Case', () => {
    it('Should send telemetry for debug test case', async () => {
      getLwcTestRunnerExecutableStub.returns(lwcTestExecutablePath);
      const mockExecutionTime: [number, number] = [123, 456];
      processHrtimeStub.returns(mockExecutionTime);
      const debugConfiguration = getDebugConfiguration(command, args, cwd);
      await forceLwcTestCaseDebug({
        testExecutionInfo
      });
      const mockDebugSession = {
        id: 'mockId',
        type: 'node',
        name: debugConfiguration.name,
        workspaceFolder: debugConfiguration.cwd,
        configuration: debugConfiguration,
        customRequest: (cmd: string) => Promise.resolve()
      };
      handleDidStartDebugSession(mockDebugSession);
      handleDidTerminateDebugSession(mockDebugSession);
      assert.calledOnce(telemetryStub);
      assert.calledWith(
        telemetryStub,
        FORCE_LWC_TEST_DEBUG_LOG_NAME,
        mockExecutionTime
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
      await forceLwcTestFileDebug({
        testExecutionInfo: mockTestFileInfo
      });
      const expectedCwd = vscode.workspace.workspaceFolders![0].uri.fsPath;
      assert.calledWith(debugStub, vscode.workspace.workspaceFolders![0], {
        args: [
          '--debug',
          '--',
          '--json',
          '--outputFile',
          path.join(
            expectedCwd,
            '.sfdx',
            'tools',
            'testresults',
            'lwc',
            `test-result-${mockUuid}.json`
          ),
          '--testLocationInResults',
          '--runTestsByPath',
          /^win32/.test(process.platform)
            ? path.relative(expectedCwd, mockTestFileInfo.testUri.fsPath)
            : mockTestFileInfo.testUri.fsPath
        ],
        console: 'integratedTerminal',
        cwd: expectedCwd,
        disableOptimisticBPs: true,
        internalConsoleOptions: 'openOnSessionStart',
        name: 'Debug LWC test(s)',
        port: 9229,
        request: 'launch',
        runtimeExecutable: lwcTestExecutablePath,
        sfdxDebugSessionId: mockUuid,
        type: 'node'
      });
    });

    it('Should debug active text editor test file', async () => {
      mockActiveTextEditorUri(mockTestFileInfo.testUri);
      await forceLwcTestDebugActiveTextEditorTest();
      const expectedCwd = vscode.workspace.workspaceFolders![0].uri.fsPath;
      assert.calledWith(debugStub, vscode.workspace.workspaceFolders![0], {
        args: [
          '--debug',
          '--',
          '--json',
          '--outputFile',
          path.join(
            expectedCwd,
            '.sfdx',
            'tools',
            'testresults',
            'lwc',
            `test-result-${mockUuid}.json`
          ),
          '--testLocationInResults',
          '--runTestsByPath',
          /^win32/.test(process.platform)
            ? path.relative(expectedCwd, mockTestFileInfo.testUri.fsPath)
            : mockTestFileInfo.testUri.fsPath
        ],
        console: 'integratedTerminal',
        cwd: expectedCwd,
        disableOptimisticBPs: true,
        internalConsoleOptions: 'openOnSessionStart',
        name: 'Debug LWC test(s)',
        port: 9229,
        request: 'launch',
        runtimeExecutable: lwcTestExecutablePath,
        sfdxDebugSessionId: mockUuid,
        type: 'node'
      });
      unmockActiveTextEditorUri();
    });
  });
});
