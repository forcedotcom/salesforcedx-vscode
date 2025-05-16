/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import * as workspaceUtils from '../../../../src';
import { TelemetryFile } from '../../../../src/telemetry/reporters/telemetryFile';

jest.mock('vscode');
const vscodeMocked = jest.mocked(vscode);

describe('TelemetryFile', () => {
  let telemetryFile: TelemetryFile;
  let writeToFileMock: jest.SpyInstance;
  let getRootWorkspacePathSpy: jest.SpyInstance;
  const dummyExtensionId = 'extensionId';
  const mockWorkspacePath = '/mock/workspace/path';

  beforeEach(() => {
    // Mock getRootWorkspacePath first
    getRootWorkspacePathSpy = jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue(mockWorkspacePath);

    // Mock Uri.file before creating TelemetryFile instance
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

    // Create TelemetryFile instance after mocks are set up
    telemetryFile = new TelemetryFile(dummyExtensionId);
    writeToFileMock = jest.spyOn(telemetryFile as any, 'writeToFile');
    vscodeMocked.workspace.fs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    getRootWorkspacePathSpy.mockRestore();
  });

  it('should append the telemetry event to the telemetry file.', () => {
    const eventName = 'testEvent';
    const properties = { key1: 'value1', key2: 'value2' };
    const measurements = { metric1: 10, metric2: 20 };

    telemetryFile.sendTelemetryEvent(eventName, properties, measurements);

    expect(writeToFileMock).toHaveBeenCalledWith(eventName, {
      ...properties,
      ...measurements
    });
  });

  it('should append the exception event to the telemetry file', () => {
    const exceptionName = 'testException';
    const exceptionMessage = 'Test exception message';
    const measurements = { metric1: 10, metric2: 20 };

    telemetryFile.sendExceptionEvent(exceptionName, exceptionMessage, measurements);

    expect(writeToFileMock).toHaveBeenCalledWith(exceptionName, {
      exceptionMessage,
      ...measurements
    });
  });

  it('should dispose', async () => {
    await expect(telemetryFile.dispose()).resolves.toBeUndefined();
  });

  describe('writeToFile', () => {
    it('should append data to the telemetry file', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2020-01-01'));
      const eventName = 'testEvent';
      const properties = { key1: 'value1', key2: 'value2' };

      await (telemetryFile as any).writeToFile(eventName, properties);

      expect(vscodeMocked.workspace.fs.writeFile).toHaveBeenCalled();
      const writeCall = (vscodeMocked.workspace.fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = writeCall[1].toString();
      expect([`${dummyExtensionId}-telemetry.json`, writtenData]).toMatchSnapshot();
    });
  });
});
