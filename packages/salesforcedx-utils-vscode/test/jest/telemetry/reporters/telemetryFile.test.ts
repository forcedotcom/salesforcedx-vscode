/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { TelemetryFile } from '../../../../src/telemetry/reporters/telemetryFile';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    appendFile: jest.fn().mockResolvedValue({})
  }
}));

describe('TelemetryFile', () => {
  let telemetryFile: TelemetryFile;
  let writeToFileMock: jest.SpyInstance;
  const dummyExtensionId = 'extensionId';

  beforeEach(() => {
    telemetryFile = new TelemetryFile(dummyExtensionId);
    writeToFileMock = jest.spyOn(telemetryFile as any, 'writeToFile');
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

      expect((fs.promises.appendFile as jest.Mock).mock.calls[0]).toMatchSnapshot();
    });
  });
});
