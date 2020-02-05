/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestRunner as UtilsTestRunner } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/';
import * as fs from 'fs';
import * as path from 'path';
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

let existsSyncStub: SinonStub;
let sfdxTaskExecuteStub: SinonStub;
let activeTextEditorStub: SinonStub;
let getTempFolderStub: SinonStub;
let watchTestResultsStub: SinonStub;
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

export function mockGetLwcTestRunnerExecutable() {
  existsSyncStub = stub(fs, 'existsSync');
  existsSyncStub.returns(true);
}

export function unmockGetLwcTestRunnerExecutable() {
  existsSyncStub.restore();
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
