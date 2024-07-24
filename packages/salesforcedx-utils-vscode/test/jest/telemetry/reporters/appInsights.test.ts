/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { workspace } from 'vscode';
import { WorkspaceContextUtil } from '../../../../src';
import { AppInsights } from '../../../../src/telemetry/reporters/appInsights';

describe('AppInsights', () => {
  const fakeExtensionId = 'anExtensionId';
  const fakeExtensionVersion = '0.10.0';
  const fakeUserId = '45gkjnbxsbchdnv34sbcishsm';

  describe('sendTelemetryEvent and sendExceptionEvent', () => {
    let getInstanceMock: jest.SpyInstance;
    const dummyOrgId = '000dummyOrgId';
    const getMock = jest.fn().mockReturnValueOnce(true);
    const fakeConfig: any = { get: getMock };

    let appInsights: AppInsights;
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
      jest
        .spyOn(AppInsights.prototype as any, 'updateUserOptIn')
        .mockReturnValue('');
    });

    it('should send telemetry data to appInsightsClient.trackEvent', () => {
      appInsights = new AppInsights(fakeExtensionId, fakeExtensionVersion, '', fakeUserId);
      (appInsights as any).userOptIn = true;
      (appInsights as any).appInsightsClient = {
        trackException: trackExceptionMock,
        trackEvent: trackEventMock
      };

      // Act
      appInsights.sendTelemetryEvent('Dummy Telemetry Event', {}, {});

      // Assert
      expect(getInstanceMock).toHaveBeenCalledTimes(1);
      expect(trackEventMock).toHaveBeenCalledTimes(1);
      expect(trackEventMock.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should send orgId to appInsightsClient.trackException', () => {
      // Act
      appInsights.sendExceptionEvent(
        'Dummy Exception',
        'a dummy exception occurred'
      );

      // Assert
      expect(getInstanceMock).toHaveBeenCalledTimes(1);
      expect(trackExceptionMock).toHaveBeenCalledTimes(1);
      expect(trackExceptionMock.mock.calls[0][0]).toMatchSnapshot();
    });
  });

  describe('dispose', () => {
    let appInsights: AppInsights;
    const flushMock = jest.fn();
    const appInsightsClientMock = {
      flush: flushMock
    };

    beforeEach(() => {
      appInsights = new AppInsights(
        fakeExtensionId,
        fakeExtensionVersion,
        'aKey',
        fakeUserId
      );
      (appInsights as any).appInsightsClient = appInsightsClientMock;
    });

    it('should flush events to appInsightsClient and resolve', () => {
      const expectedPromiseResult = Promise.resolve();

      const disposePromise = appInsights.dispose();

      expect(flushMock).toHaveBeenCalledTimes(1);
      expect(disposePromise).toEqual(expectedPromiseResult);
    });

    it('should resolve immediately if appInsightsClient is undefined', () => {
      (appInsights as any).appInsightsClient = undefined;
      const expectedPromiseResult = Promise.resolve();

      const disposePromise = appInsights.dispose();

      expect(disposePromise).toEqual(expectedPromiseResult);
    });
  });
});
