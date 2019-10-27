import * as fs from 'fs';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import Uri from 'vscode-uri';
import { SfdxTask } from '../../../../src/testSupport/testRunner/taskService';
import {
  TestFileInfo,
  TestInfoKind,
  TestType
} from '../../../../src/testSupport/types';

let existsSyncStub: SinonStub;
let sfdxTaskExecuteStub: SinonStub;
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
    testUri: Uri.file(mockTestFilePath)
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

export function mockSfdxTaskExecute() {
  sfdxTaskExecuteStub = stub(SfdxTask.prototype, 'execute');
  sfdxTaskExecuteStub.callsFake(async function(
    this: SfdxTask
  ): Promise<SfdxTask> {
    this.notifyEndTask();
    return this;
  });
}

export function unmockSfdxTaskExecute() {
  sfdxTaskExecuteStub.restore();
}
