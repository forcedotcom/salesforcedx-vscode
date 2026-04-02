/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
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

  const expectedUri = Utils.joinPath(URI.file(fakeLogFilePath), `${fakeExtensionId}.txt`);

  beforeEach(() => {
    workspaceContextUtilGetInstanceSpy = jest
      .spyOn(WorkspaceContextUtil, 'getInstance')
      .mockReturnValue(mockWorkspaceContextUtil as any);

    writeFileSpy = jest.spyOn(vscodeMocked.workspace.fs, 'writeFile');
    writeFileSpy.mockResolvedValue(undefined);
  });

  it('should write the telemetry event to the file', async () => {
    const eventName = 'myEvent';
    const properties = { key: 'value' };
    const measurements = { count: 1 };
    logStream = new LogStream(fakeExtensionId, fakeLogFilePath);

    logStream.sendTelemetryEvent(eventName, properties, measurements);
    await logStream.dispose(); // This will flush the buffer

    expect(writeFileSpy).toHaveBeenCalledTimes(2);

    // Verify the URI for both calls
    expect(writeFileSpy.mock.calls[0][0].toString()).toBe(expectedUri.toString());
    expect(writeFileSpy.mock.calls[1][0].toString()).toBe(expectedUri.toString());

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

    expect(writeFileSpy).toHaveBeenCalledTimes(2);

    // Verify the URI for both calls
    expect(writeFileSpy.mock.calls[0][0].toString()).toBe(expectedUri.toString());
    expect(writeFileSpy.mock.calls[1][0].toString()).toBe(expectedUri.toString());

    // Verify the Buffer content
    const firstCallData = writeFileSpy.mock.calls[0][1].toString();
    expect(firstCallData).toMatchSnapshot();
    expect(workspaceContextUtilGetInstanceSpy).toHaveBeenCalled();
  });
});
