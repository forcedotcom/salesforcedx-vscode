/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import { WorkspaceContextUtil } from '../../../../src';
import { LogStream } from '../../../../src/telemetry/reporters/logStream';

const vscodeMocked = jest.mocked(vscode);

describe('LogStream', () => {
  const fakeExtensionId = 'myExtension';
  const fakeLogFilePath = '/path/to/logs';
  const mockWorkspaceContextUtil = {
    onOrgChange: jest.fn(),
    getConnection: jest.fn(),
    orgId: ''
  };
  let workspaceContextUtilGetInstanceSpy: jest.SpyInstance;
  let logStream: LogStream;
  let writeFileSpy: jest.SpyInstance;

  beforeEach(() => {
    workspaceContextUtilGetInstanceSpy = jest
      .spyOn(WorkspaceContextUtil, 'getInstance')
      .mockReturnValue(mockWorkspaceContextUtil as any);

    writeFileSpy = jest.spyOn(vscodeMocked.workspace.fs, 'writeFile');
    writeFileSpy.mockResolvedValue(undefined);

    vscodeMocked.Uri.file.mockImplementation(filePath => ({
      fsPath: filePath,
      scheme: 'file',
      authority: '',
      path: filePath,
      query: '',
      fragment: '',
      with: jest.fn(),
      toString: jest.fn().mockReturnValue(`file://${filePath}`),
      toJSON: jest.fn().mockReturnValue({ scheme: 'file', path: filePath })
    }));
  });

  it('should write the telemetry event to the file', async () => {
    const eventName = 'myEvent';
    const properties = { key: 'value' };
    const measurements = { count: 1 };
    logStream = new LogStream(fakeExtensionId, fakeLogFilePath);

    logStream.sendTelemetryEvent(eventName, properties, measurements);
    await logStream.dispose(); // This will flush the buffer

    const expectedPath = path.join(fakeLogFilePath, `${fakeExtensionId}.txt`);
    expect(writeFileSpy).toHaveBeenCalledTimes(2);

    // Verify the URI for both calls
    const expectedUri = vscode.Uri.file(expectedPath);
    expect(writeFileSpy.mock.calls[0][0].fsPath).toBe(expectedUri.fsPath);
    expect(writeFileSpy.mock.calls[1][0].fsPath).toBe(expectedUri.fsPath);

    // Verify the Buffer content
    const firstCallData = writeFileSpy.mock.calls[0][1].toString();
    expect(firstCallData).toMatchSnapshot();

    expect(workspaceContextUtilGetInstanceSpy).toHaveBeenCalled();
  });

  it('should write the exception event to the file', async () => {
    const exceptionName = 'myException';
    const exceptionMessage = 'An exception occurred';
    const measurements = { count: 1 };
    logStream = new LogStream(fakeExtensionId, fakeLogFilePath);

    logStream.sendExceptionEvent(exceptionName, exceptionMessage, measurements);
    await logStream.dispose(); // This will flush the buffer

    const expectedPath = path.join(fakeLogFilePath, `${fakeExtensionId}.txt`);
    expect(writeFileSpy).toHaveBeenCalledTimes(2);

    // Verify the URI for both calls
    const expectedUri = vscode.Uri.file(expectedPath);
    expect(writeFileSpy.mock.calls[0][0].fsPath).toBe(expectedUri.fsPath);
    expect(writeFileSpy.mock.calls[1][0].fsPath).toBe(expectedUri.fsPath);

    // Verify the Buffer content
    const firstCallData = writeFileSpy.mock.calls[0][1].toString();
    expect(firstCallData).toMatchSnapshot();
    expect(workspaceContextUtilGetInstanceSpy).toHaveBeenCalled();
  });
});
