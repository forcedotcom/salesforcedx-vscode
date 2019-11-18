/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import URI from 'vscode-uri';
import { SfdxTask } from '../../../../src/testSupport/testRunner/taskService';
import {
  TestFileInfo,
  TestInfoKind,
  TestType
} from '../../../../src/testSupport/types';

let existsSyncStub: SinonStub;
let sfdxTaskExecuteStub: SinonStub;
let activeTextEditorStub: SinonStub;
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
