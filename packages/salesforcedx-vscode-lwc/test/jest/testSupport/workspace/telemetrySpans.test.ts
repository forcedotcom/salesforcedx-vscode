/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { createRecordingRuntimeMock, type RecordedSpan } from '../../testUtils/recordingTracer';

const mockRecordedSpans: RecordedSpan[] = [];

jest.mock('../../../../src/services/runtime', () => createRecordingRuntimeMock(() => mockRecordedSpans));

import { getRuntime } from '../../../../src/services/runtime';
import { getLwcTestRunnerExecutable } from '../../../../src/testSupport/workspace/getLwcTestRunnerExecutable';
import { getTestWorkspaceFolder } from '../../../../src/testSupport/workspace/getTestWorkspaceFolder';
import { workspaceService } from '../../../../src/testSupport/workspace/workspaceService';

describe('workspace telemetry spans', () => {
  beforeEach(() => {
    mockRecordedSpans.length = 0;
  });

  it('records the unsupported-workspace exception', async () => {
    workspaceService.setCurrentWorkspaceType('UNKNOWN');

    await getRuntime().runPromise(getLwcTestRunnerExecutable('/project'));

    const exceptionSpan = mockRecordedSpans.find(span => span.name === 'exception');
    expect(exceptionSpan?.attributes.get('name')).toBe('lwc_test_no_lwc_testrunner_found');
    expect(exceptionSpan?.attributes.get('message')).toBe('Unsupported workspace');
    expect(exceptionSpan?.ended).toBe(true);
  });

  it('records the missing-workspace-folder exception', () => {
    Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: [], configurable: true });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    getTestWorkspaceFolder();

    const exceptionSpan = mockRecordedSpans.find(span => span.name === 'exception');
    expect(exceptionSpan?.attributes.get('name')).toBe('lwc_test_no_workspace_folder_found_for_test');
    expect(exceptionSpan?.attributes.get('message')).toEqual(expect.any(String));
    expect(exceptionSpan?.ended).toBe(true);
    consoleError.mockRestore();
  });
});
