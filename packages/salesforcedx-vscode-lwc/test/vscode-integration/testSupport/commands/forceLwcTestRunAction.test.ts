/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { assert, match, SinonStub, stub } from 'sinon';
import * as uuid from 'uuid';
import * as vscode from 'vscode';
import { telemetryService } from '../../../../src/telemetry';
import {
  forceLwcTestRun,
  forceLwcTestRunActiveTextEditorTest
} from '../../../../src/testSupport/commands/forceLwcTestRunAction';
import { getLwcTestRunnerExecutable } from '../../../../src/testSupport/workspace';
import { FORCE_LWC_TEST_RUN_LOG_NAME } from '../../../../src/testSupport/types/constants';
import {
  createMockTestFileInfo,
  mockActiveTextEditorUri,
  mockGetLwcTestRunnerExecutable,
  mockSfdxTaskExecute,
  mockTestResultWatcher,
  unmockActiveTextEditorUri,
  unmockGetLwcTestRunnerExecutable,
  unmockSfdxTaskExecute,
  unmockTestResultWatcher
} from '../mocks';
import { InputBuffer } from 'uuid/interfaces';

describe('Force LWC Test Run - Code Action', () => {
  describe('Telemetry for running tests', () => {
    let telemetryStub: SinonStub<
      [(string | undefined)?, ([number, number] | undefined)?, any?, any?],
      void
    >;
    let processHrtimeStub: SinonStub<
      [([number, number] | undefined)?],
      [number, number]
    >;
    beforeEach(() => {
      telemetryStub = stub(telemetryService, 'sendCommandEvent');
      processHrtimeStub = stub(process, 'hrtime');
      mockSfdxTaskExecute(true);
      mockGetLwcTestRunnerExecutable();
    });

    afterEach(() => {
      telemetryStub.restore();
      processHrtimeStub.restore();
      unmockGetLwcTestRunnerExecutable();
      unmockSfdxTaskExecute();
    });

    it('Should send telemetry for running tests', async () => {
      const testExecutionInfo = createMockTestFileInfo();
      const mockExecutionTime: [number, number] = [123, 456];
      processHrtimeStub.returns(mockExecutionTime);
      await forceLwcTestRun(testExecutionInfo);
      assert.calledOnce(telemetryStub);
      assert.calledWith(
        telemetryStub,
        FORCE_LWC_TEST_RUN_LOG_NAME,
        mockExecutionTime,
        {
          workspaceType: 'SFDX'
        }
      );

      processHrtimeStub.restore();
    });
  });

  describe('Run Test File', () => {
    let uuidStub: SinonStub<
      [({ random: InputBuffer } | { rng(): InputBuffer } | undefined)?],
      string
    >;
    let executeTaskStub: SinonStub<
      [vscode.Task],
      Thenable<vscode.TaskExecution | void>
    >;
    const mockUuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    beforeEach(() => {
      mockGetLwcTestRunnerExecutable();
      mockTestResultWatcher();
      uuidStub = stub(uuid, 'v4');
      uuidStub.returns(mockUuid);
      executeTaskStub = stub(vscode.tasks, 'executeTask');
      executeTaskStub.returns(Promise.resolve());
    });
    afterEach(() => {
      unmockGetLwcTestRunnerExecutable();
      unmockTestResultWatcher();
      uuidStub.restore();
      executeTaskStub.restore();
    });

    const mockTestFileInfo = createMockTestFileInfo();
    it('Should run active text editor test file', async () => {
      mockActiveTextEditorUri(mockTestFileInfo.testUri);
      await forceLwcTestRunActiveTextEditorTest();

      const expectedCwd = vscode.workspace.workspaceFolders![0].uri.fsPath;
      const expectedOptions = /^win32/.test(process.platform)
        ? {
            executable: 'cmd.exe',
            shellArgs: ['/d', '/c']
          }
        : undefined;
      const lwcTestRunnerExecutable = getLwcTestRunnerExecutable(expectedCwd);
      assert.calledOnce(executeTaskStub);
      assert.calledWith(
        executeTaskStub,
        match.has('execution', match.has('command', lwcTestRunnerExecutable))
      );
      assert.calledWith(
        executeTaskStub,
        match.has(
          'execution',
          match.has('args', [
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
          ])
        )
      );
      assert.calledWith(
        executeTaskStub,
        match.has('execution', match.has('options', expectedOptions))
      );
      unmockActiveTextEditorUri();
    });
  });
});
