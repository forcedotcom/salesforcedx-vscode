/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { shared as lspCommon } from '@salesforce/lightning-lsp-common';
import { TestRunner as UtilsTestRunner } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/';
import * as fs from 'fs';
import * as path from 'path';
import * as which from 'which';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import URI from 'vscode-uri';
import { SfdxTask } from '../../../../src/testSupport/testRunner/taskService';
import { testResultsWatcher } from '../../../../src/testSupport/testRunner/testResultsWatcher';
import {
  TestFileInfo,
  TestInfoKind,
  TestType
} from '../../../../src/testSupport/types';

let existsSyncStub: SinonStub<[fs.PathLike], boolean>;
let whichSyncStub: SinonStub<[string], fs.PathLike>;
let sfdxTaskExecuteStub: SinonStub<[], Promise<SfdxTask>>;
let activeTextEditorStub: SinonStub<any[], any>;
let getTempFolderStub: SinonStub<[string, string], string>;
let watchTestResultsStub: SinonStub<[string], void>;
export function createMockTestFileInfo() {
  const mockDirectory = path.join(
    vscode.workspace.workspaceFolders![0].uri.fsPath,
    'force-app',
    'main',
    'lwc',
    'mockComponent',
    '__tests__'
  );

  const mockTestFile = 'mockTest.test.js';
  const mockTestFilePath = path.join(mockDirectory, mockTestFile);
  const testExecutionInfo: TestFileInfo = {
    kind: TestInfoKind.TEST_FILE,
    testType: TestType.LWC,
    testUri: URI.file(mockTestFilePath)
  };
  return testExecutionInfo;
}

export function mockGetLwcTestRunnerExecutable(
  mockWorkspaceType: lspCommon.WorkspaceType = lspCommon.WorkspaceType.SFDX
) {
  if (mockWorkspaceType === lspCommon.WorkspaceType.SFDX) {
    existsSyncStub = stub(fs, 'existsSync');
    existsSyncStub.returns(true);
  }
  if (
    mockWorkspaceType === lspCommon.WorkspaceType.CORE_ALL ||
    mockWorkspaceType === lspCommon.WorkspaceType.CORE_PARTIAL
  ) {
    whichSyncStub = stub(which, 'sync');
    whichSyncStub.returns(path.join('usr', 'local', 'bin', 'lwc-test'));
    existsSyncStub = stub(fs, 'existsSync');
    existsSyncStub.returns(true);
  }
}

export function unmockGetLwcTestRunnerExecutable() {
  if (existsSyncStub) {
    existsSyncStub.restore();
  }
  if (whichSyncStub) {
    whichSyncStub.restore();
  }
}

export function mockSfdxTaskExecute(immediate?: boolean) {
  sfdxTaskExecuteStub = stub(SfdxTask.prototype, 'execute');
  sfdxTaskExecuteStub.callsFake(async function(
    this: SfdxTask
  ): Promise<SfdxTask> {
    if (immediate) {
      this.notifyEndTask();
      return this;
    }
    const task = this;
    return Promise.resolve().then(() => {
      setTimeout(() => {
        task.notifyEndTask();
      }, 0);
      return task;
    });
  });
}

export function unmockSfdxTaskExecute() {
  sfdxTaskExecuteStub.restore();
}

/**
 * Mock active text editor with provided mock test uri
 * @param testUri mock test uri
 */
export function mockActiveTextEditorUri(testUri: vscode.Uri) {
  const mockActiveTextEditor = {
    document: {
      uri: testUri,
      languageId: 'javascript'
    }
  };
  activeTextEditorStub = stub(vscode.window, 'activeTextEditor').get(() => {
    return mockActiveTextEditor;
  });
}

export function unmockActiveTextEditorUri() {
  activeTextEditorStub.restore();
}

/**
 * Mock test result watcher's get temp folder and watch test results methods
 */
export function mockTestResultWatcher() {
  getTempFolderStub = stub(UtilsTestRunner.prototype, 'getTempFolder');
  getTempFolderStub.callsFake((vscodePath: string, testType: string) => {
    return path.join(vscodePath, '.sfdx', 'tools', 'testresults', testType);
  });
  watchTestResultsStub = stub(testResultsWatcher, 'watchTestResults');
  watchTestResultsStub.callsFake(() => {});
}

export function unmockTestResultWatcher() {
  getTempFolderStub.restore();
  watchTestResultsStub.restore();
}
