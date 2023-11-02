/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { workspace } from 'vscode';
import { TelemetryReporter, WorkspaceContextUtil } from '../../../src';

describe('Telemetry Reporter', () => {
  describe('sendTelemetryEvent and sendExceptionEvent', () => {
    let getInstanceMock: jest.SpyInstance;
    const dummyOrgId = '000dummyOrgId';
    const getMock = jest.fn().mockReturnValueOnce(true);
    const fakeConfig: any = { get: getMock };

    let telemetryReporter: TelemetryReporter;
    const trackExceptionMock = jest.fn();
    const trackEventMock = jest.fn();
    const writeMock = jest.fn();

    beforeEach(() => {
      // Arrange
      getInstanceMock = jest
        .spyOn(WorkspaceContextUtil, 'getInstance')
        .mockReturnValue({
          orgId: dummyOrgId
        } as any);

      jest.spyOn(workspace, 'getConfiguration').mockReturnValue(fakeConfig);

      telemetryReporter = new TelemetryReporter('', '', '');
      (telemetryReporter as any).userOptIn = true;
      (telemetryReporter as any).appInsightsClient = {
        trackException: trackExceptionMock,
        trackEvent: trackEventMock
      };
      (telemetryReporter as any).logStream = {
        write: writeMock
      };
    });

    afterEach(() => {
      // Shared assertions
      expect(writeMock).toHaveBeenCalledTimes(1);
      expect(writeMock.mock.calls[0][0].includes(dummyOrgId)).toEqual(true);
    });

    it('should send orgId to appInsightsClient.trackEvent and logStream.write', () => {
      // Act
      telemetryReporter.sendTelemetryEvent('Dummy Telemetry Event', {}, {});

      // Assert
      expect(trackEventMock).toHaveBeenCalledTimes(1);
      expect(trackEventMock.mock.calls[0][0].properties.orgId).toEqual(
        dummyOrgId
      );
    });

    it('should send orgId to appInsightsClient.trackException and logStream.write', () => {
      // Act
      telemetryReporter.sendExceptionEvent(
        'Dummy Exception',
        'a dummy exception occurred'
      );

      // Assert
      expect(trackExceptionMock).toHaveBeenCalledTimes(1);
      expect(trackExceptionMock.mock.calls[0][0].properties.orgId).toEqual(
        dummyOrgId
      );
    });
  });
});
