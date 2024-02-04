/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { workspace } from 'vscode';
import { WorkspaceContextUtil } from '../../../src';
import { AppInsights } from '../../../src/telemetry/appInsightsReporter';

describe('AppInsightsReporter', () => {
  describe('sendTelemetryEvent and sendExceptionEvent', () => {
    let getInstanceMock: jest.SpyInstance;
    const dummyOrgId = '000dummyOrgId';
    const getMock = jest.fn().mockReturnValueOnce(true);
    const fakeConfig: any = { get: getMock };

    let appInsightsReporter: AppInsights;
    const trackExceptionMock = jest.fn();
    const trackEventMock = jest.fn();

    beforeEach(() => {
      // Arrange
      getInstanceMock = jest
        .spyOn(WorkspaceContextUtil, 'getInstance')
        .mockReturnValue({
          orgId: dummyOrgId
        } as any);

      jest.spyOn(workspace, 'getConfiguration').mockReturnValue(fakeConfig);

      appInsightsReporter = new AppInsights('', '', '');
      (appInsightsReporter as any).userOptIn = true;
      (appInsightsReporter as any).appInsightsClient = {
        trackException: trackExceptionMock,
        trackEvent: trackEventMock
      };
    });

    it('should send orgId to appInsightsClient.trackEvent', () => {
      // Act
      appInsightsReporter.sendTelemetryEvent('Dummy Telemetry Event', {}, {});

      // Assert
      expect(getInstanceMock).toHaveBeenCalledTimes(1);
      expect(trackEventMock).toHaveBeenCalledTimes(1);
      expect(trackEventMock.mock.calls[0][0].properties.orgId).toEqual(
        dummyOrgId
      );
    });

    it('should send orgId to appInsightsClient.trackException', () => {
      // Act
      appInsightsReporter.sendExceptionEvent(
        'Dummy Exception',
        'a dummy exception occurred'
      );

      // Assert
      expect(getInstanceMock).toHaveBeenCalledTimes(1);
      expect(trackExceptionMock).toHaveBeenCalledTimes(1);
      expect(trackExceptionMock.mock.calls[0][0].properties.orgId).toEqual(
        dummyOrgId
      );
    });
  });
});
