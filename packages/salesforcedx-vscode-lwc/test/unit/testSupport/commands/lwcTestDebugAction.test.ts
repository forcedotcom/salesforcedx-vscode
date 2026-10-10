/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { URI } from 'vscode-uri';
import { createRecordingRuntimeMock, type RecordedSpan } from '../../testUtils/recordingTracer';

const runByExecutionInfo = vi.fn();
const runActiveEditorFile = vi.fn();
const mockRecordedSpans: RecordedSpan[] = [];

vi.mock('../../../../src/services/runtime', () => createRecordingRuntimeMock(() => mockRecordedSpans));

vi.mock('../../../../src/testSupport/testExplorer/lwcTestController', () => ({
  getLwcTestController: () => ({ runByExecutionInfo, runActiveEditorFile })
}));

import {
  handleDidStartDebugSession,
  handleDidTerminateDebugSession,
  lwcTestFileDebug,
  lwcTestCaseDebug,
  lwcTestDebugActiveTextEditorTest
} from '../../../../src/testSupport/commands/lwcTestDebugAction';
import { workspaceService } from '../../../../src/testSupport/workspace/workspaceService';

describe('lwcTestDebugAction routes through the controller', () => {
  beforeEach(() => {
    runByExecutionInfo.mockClear();
    runActiveEditorFile.mockClear();
    mockRecordedSpans.length = 0;
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

  it('records the completed debug session span', () => {
    const performanceNow = vi.spyOn(globalThis.performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(125);
    workspaceService.setCurrentWorkspaceType('SFDX');
    const session = {
      configuration: { sfDebugSessionId: 'debug-session' }
    } as unknown as import('vscode').DebugSession;

    handleDidStartDebugSession(session);
    handleDidTerminateDebugSession(session);

    const debugSpan = mockRecordedSpans.find(span => span.name === 'lwc_test_debug_action');
    expect(debugSpan?.attributes.get('workspaceType')).toBe('SFDX');
    expect(debugSpan?.attributes.get('executionTime')).toBe(25);
    expect(debugSpan?.ended).toBe(true);
    performanceNow.mockRestore();
  });
});
