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

import {
  lwcTestFileDebug,
  lwcTestCaseDebug,
  lwcTestDebugActiveTextEditorTest
} from '../../../../src/testSupport/commands/lwcTestDebugAction';

describe('lwcTestDebugAction routes through the controller', () => {
  beforeEach(() => {
    runByExecutionInfo.mockClear();
    runActiveEditorFile.mockClear();
  });

  it('lwcTestFileDebug calls controller.runByExecutionInfo with isDebug=true', async () => {
    const testExecutionInfo = { kind: 'testFile' as const, testUri: URI.file('/a/foo.test.js') };
    await lwcTestFileDebug({ testExecutionInfo });
    expect(runByExecutionInfo).toHaveBeenCalledWith(testExecutionInfo, true);
  });

  it('lwcTestCaseDebug calls controller.runByExecutionInfo with isDebug=true', async () => {
    const testExecutionInfo = { kind: 'testCase' as const, testUri: URI.file('/a/foo.test.js'), testName: 'does x' };
    await lwcTestCaseDebug({ testExecutionInfo });
    expect(runByExecutionInfo).toHaveBeenCalledWith(testExecutionInfo, true);
  });

  it('lwcTestDebugActiveTextEditorTest calls controller.runActiveEditorFile with isDebug=true', async () => {
    await lwcTestDebugActiveTextEditorTest();
    expect(runActiveEditorFile).toHaveBeenCalledWith(true);
  });
});
