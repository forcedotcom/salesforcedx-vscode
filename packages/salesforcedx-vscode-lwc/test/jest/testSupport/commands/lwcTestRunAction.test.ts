/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { URI } from 'vscode-uri';

const runByExecutionInfo = jest.fn();
const runActiveEditorFile = jest.fn();

jest.mock('../../../../src/testSupport/testExplorer/lwcTestController', () => ({
  getLwcTestController: () => ({ runByExecutionInfo, runActiveEditorFile })
}));

import { lwcTestFileRun, lwcTestCaseRun } from '../../../../src/testSupport/commands/lwcTestRunAction';

describe('lwcTestRunAction routes through the controller', () => {
  beforeEach(() => {
    runByExecutionInfo.mockClear();
    runActiveEditorFile.mockClear();
  });

  it('lwcTestFileRun calls controller.runByExecutionInfo with isDebug=false', () => {
    const testExecutionInfo = { kind: 'testFile', testUri: URI.file('/a/foo.test.js') };
    lwcTestFileRun({ testExecutionInfo });
    expect(runByExecutionInfo).toHaveBeenCalledWith(testExecutionInfo, false);
  });

  it('lwcTestCaseRun calls controller.runByExecutionInfo with isDebug=false', () => {
    const testExecutionInfo = { kind: 'testCase', testUri: URI.file('/a/foo.test.js'), testName: 'does x' };
    lwcTestCaseRun({ testExecutionInfo });
    expect(runByExecutionInfo).toHaveBeenCalledWith(testExecutionInfo, false);
  });
});
