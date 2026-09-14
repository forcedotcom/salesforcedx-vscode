/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Logger from 'effect/Logger';
import { NoWorkspaceOpenError } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { createRecordingRuntimeMock, type RecordedSpan } from '../../testUtils/recordingTracer';

const mockRecordedSpans: RecordedSpan[] = [];
const mockGetWorkspaceInfoOrThrow = jest.fn();
const loggedMessages: unknown[] = [];
type ServicesApi = Effect.Effect.Success<ExtensionProviderService['getServicesApi']>;
const servicesApiLayer = Layer.succeed(ExtensionProviderService, {
  getServicesApi: Effect.succeed({
    services: {
      WorkspaceService: {
        getWorkspaceInfoOrThrow: mockGetWorkspaceInfoOrThrow
      }
    }
  } as unknown as ServicesApi)
});
const loggerLayer = Logger.replace(
  Logger.defaultLogger,
  Logger.make(({ message }) => loggedMessages.push(message))
);
const testLayer = Layer.merge(servicesApiLayer, loggerLayer);

jest.mock('../../../../src/services/runtime', () => createRecordingRuntimeMock(() => mockRecordedSpans));

import { getRuntime } from '../../../../src/services/runtime';
import { getLwcTestRunnerExecutable } from '../../../../src/testSupport/workspace/getLwcTestRunnerExecutable';
import { getTestWorkspaceFolder } from '../../../../src/testSupport/workspace/getTestWorkspaceFolder';
import { workspaceService } from '../../../../src/testSupport/workspace/workspaceService';

describe('workspace telemetry spans', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordedSpans.length = 0;
    loggedMessages.length = 0;
  });

  it('records the unsupported-workspace exception', async () => {
    workspaceService.setCurrentWorkspaceType('UNKNOWN');

    await getRuntime().runPromise(getLwcTestRunnerExecutable('/project'));

    const exceptionSpan = mockRecordedSpans.find(span => span.name === 'exception');
    expect(exceptionSpan?.attributes.get('name')).toBe('lwc_test_no_lwc_testrunner_found');
    expect(exceptionSpan?.attributes.get('message')).toBe('Unsupported workspace');
    expect(exceptionSpan?.ended).toBe(true);
  });

  it('uses WorkspaceService and an Effect span when no workspace is open', async () => {
    mockGetWorkspaceInfoOrThrow.mockReturnValue(
      Effect.fail(new NoWorkspaceOpenError({ message: 'No workspace is currently open' }))
    );

    const result = await getRuntime().runPromise(getTestWorkspaceFolder().pipe(Effect.provide(testLayer)));

    expect(result).toBeUndefined();
    expect(mockGetWorkspaceInfoOrThrow).toHaveBeenCalledTimes(1);
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.any(String));
    expect(loggedMessages).toHaveLength(1);
    expect(mockRecordedSpans.find(span => span.name === 'getTestWorkspaceFolder')?.ended).toBe(true);
    expect(mockRecordedSpans.some(span => span.name === 'exception')).toBe(false);
  });

  it('returns the workspace folder containing the test URI', async () => {
    const workspaceUri = URI.file('/project');
    const testUri = URI.file('/project/force-app/lwc/example/__tests__/example.test.js');
    const workspaceFolder = { uri: workspaceUri, name: 'project', index: 0 };
    mockGetWorkspaceInfoOrThrow.mockReturnValue(
      Effect.succeed({ uri: workspaceUri, path: workspaceUri.toString(), fsPath: workspaceUri.fsPath, isEmpty: false })
    );
    const getWorkspaceFolder = jest.fn().mockReturnValue(workspaceFolder);
    Object.defineProperty(vscode.workspace, 'getWorkspaceFolder', { value: getWorkspaceFolder, configurable: true });

    const result = await getRuntime().runPromise(getTestWorkspaceFolder(testUri).pipe(Effect.provide(testLayer)));

    expect(result).toBe(workspaceFolder);
    expect(getWorkspaceFolder).toHaveBeenCalledWith(testUri);
  });
});
