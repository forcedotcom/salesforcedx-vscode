/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceContextUtil } from '../../../../src';
import { LogStream } from '../../../../src/telemetry/reporters/logStream';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createWriteStream: jest.fn()
}));
const fsMocked = jest.mocked(fs);

describe('LogStream', () => {
  const fakeExtensionId = 'myExtension';
  const fakeLogFilePath = '/path/to/logs';
  const mockWorkspaceContextUtil = {
    onOrgChange: jest.fn(),
    getConnection: jest.fn()
  };
  const mockWrite = jest.fn();
  const mockEnd = jest.fn();
  let workspaceContextUtilGetInstanceSpy: jest.SpyInstance;
  let logStream: LogStream;

  beforeEach(() => {
    workspaceContextUtilGetInstanceSpy = jest
      .spyOn(WorkspaceContextUtil, 'getInstance')
      .mockReturnValue(mockWorkspaceContextUtil as any);

    fsMocked.createWriteStream.mockReturnValue({
      write: mockWrite,
      end: mockEnd
    } as any);
  });

  it('should write the telemetry event to the file', () => {
    const eventName = 'myEvent';
    const properties = { key: 'value' };
    const measurements = { count: 1 };
    logStream = new LogStream(fakeExtensionId, fakeLogFilePath);

    logStream.sendTelemetryEvent(eventName, properties, measurements);

    expect(fsMocked.createWriteStream).toHaveBeenCalledWith(
      `${path.join(fakeLogFilePath, fakeExtensionId)}.txt`,
      expect.any(Object)
    );
    expect((logStream as any).stream).toBeDefined();
    expect(workspaceContextUtilGetInstanceSpy).toHaveBeenCalled();
    expect(mockWrite.mock.calls[0][0]).toMatchSnapshot();
  });

  it('should write the exception event to the file', () => {
    const exceptionName = 'myException';
    const exceptionMessage = 'An exception occurred';
    const measurements = { count: 1 };

    logStream.sendExceptionEvent(exceptionName, exceptionMessage, measurements);

    expect(workspaceContextUtilGetInstanceSpy).toHaveBeenCalled();
    expect(mockWrite.mock.calls[0][0]).toMatchSnapshot();
  });
});
