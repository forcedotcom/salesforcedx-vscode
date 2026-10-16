/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mock as VitestMock } from 'vitest';
import { URI } from 'vscode-uri';
import { createRecordingRuntimeMock, type RecordedSpan } from '../../testUtils/recordingTracer';

const mockRecordedSpans: RecordedSpan[] = [];

vi.mock('../../../../src/services/runtime', () => createRecordingRuntimeMock(() => mockRecordedSpans));

import { getTestNamePatternArgs, TestRunner } from '../../../../src/testSupport/testRunner/testRunner';
import { taskService, type SfTask } from '../../../../src/testSupport/testRunner/taskService';
import { workspaceService } from '../../../../src/testSupport/workspace';

describe('testRunner Unit Tests.', () => {
  describe('test getTestNamePatternArgs', () => {
    it('Should return testNamePattern if flag is included', () => {
      const testName = 'Testing is Fun!';
      const testPatternArgs = getTestNamePatternArgs(testName);
      expect(testPatternArgs).toHaveLength(2);
      expect(testPatternArgs).toMatchSnapshot();
    });
    it('Should escape certain symbols if testNamePattern is included', () => {
      const testName = 'Test ?$^*().[]{}|+ Symbols';
      const testNameEscaped = 'Test \\?\\$\\^\\*\\(\\)\\.\\[\\]\\{\\}\\|\\+ Symbols';
      const testPatternArgs = getTestNamePatternArgs(testName);
      expect(testPatternArgs).toContain(testNameEscaped);
      expect(testPatternArgs).toMatchSnapshot();
    });
    it('Should not escape certain symbols if testNamePattern is included', () => {
      const testName = 'Test !@#"%&;:,<>=~` Symbols';
      const testPatternArgs = getTestNamePatternArgs(testName);
      expect(testPatternArgs).toMatchSnapshot();
    });
  });

  it('records the configured span when the task ends', async () => {
    mockRecordedSpans.length = 0;
    workspaceService.setCurrentWorkspaceType('SFDX');
    const runner = new TestRunner(
      { kind: 'testFile', testUri: URI.file('/project/foo.test.js') },
      'watch',
      'lwc_test_watch_action'
    );
    const workspaceFolder = { uri: URI.file('/project'), name: 'project', index: 0 };
    vi.spyOn(runner, 'getShellExecutionInfo').mockResolvedValue({
      command: 'lwc-jest',
      args: [],
      workspaceFolder,
      testResultFsPath: '/project/results.json'
    });
    vi.spyOn(runner, 'startWatchingTestResults').mockImplementation(() => {});
    let endTask: (() => void) | undefined;
    const sfTask = {
      onDidEnd: (callback: () => void) => {
        endTask = callback;
        return { dispose: vi.fn() };
      },
      execute: vi.fn()
    } as unknown as SfTask;
    (sfTask.execute as VitestMock).mockResolvedValue(sfTask);
    const createTask = vi.spyOn(taskService, 'createTask').mockReturnValue(sfTask);
    const performanceNow = vi.spyOn(globalThis.performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(140);

    await runner.executeAsSfTask();
    endTask?.();

    const watchSpan = mockRecordedSpans.find(span => span.name === 'lwc_test_watch_action');
    expect(watchSpan?.attributes.get('workspaceType')).toBe('SFDX');
    expect(watchSpan?.attributes.get('executionTime')).toBe(40);
    expect(watchSpan?.ended).toBe(true);
    createTask.mockRestore();
    performanceNow.mockRestore();
  });
});
