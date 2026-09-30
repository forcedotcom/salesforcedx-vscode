/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'node:os';
import { workspace } from 'vscode';
import { AppInsights } from '../../../../src/telemetry/reporters/appInsights';
import { CommonProperties, InternalProperties } from '../../../../src/telemetry/reporters/loggingProperties';
import { getCommonProperties, getInternalProperties } from '../../../../src/telemetry/reporters/telemetryUtils';
import { isInternalHost } from '../../../../src/telemetry/utils/isInternal';

vi.mock('../../../../src/telemetry/utils/isInternal', () => ({ isInternalHost: vi.fn() }));

describe('AppInsights', () => {
  const fakeExtensionId = 'anExtensionId';
  const fakeExtensionVersion = '0.10.0';
  const fakeUserId = '45gkjnbxsbchdnv34sbcishsm';
  const fakeKey = 'testKey';

  describe('sendTelemetryEvent and sendExceptionEvent', () => {
    const dummyOrgId = '000dummyOrgId';
    const getMock = vi.fn().mockReturnValueOnce(true);
    const fakeConfig: any = { get: getMock };

    let appInsights: AppInsights;
    const trackExceptionMock = vi.fn();
    const trackEventMock = vi.fn();

    beforeEach(() => {
      vi.spyOn(workspace, 'getConfiguration').mockReturnValue(fakeConfig);
      vi.spyOn(AppInsights.prototype as any, 'updateUserOptIn').mockReturnValue('');
    });

    it('should send telemetry data to appInsightsClient.trackEvent', () => {
      appInsights = new AppInsights(fakeExtensionId, fakeExtensionVersion, '', fakeUserId, 'test-webUser', false);
      appInsights.orgIdentity = { devHubId: '', orgId: dummyOrgId };
      (appInsights as any).userOptIn = true;
      (appInsights as any).appInsightsClient = {
        trackException: trackExceptionMock,
        trackEvent: trackEventMock
      };

      // Act
      appInsights.sendTelemetryEvent('Dummy Telemetry Event', {}, {});

      // Assert
      expect(trackEventMock).toHaveBeenCalledTimes(1);
      expect(trackEventMock.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should send orgId to appInsightsClient.trackException', () => {
      appInsights = new AppInsights(fakeExtensionId, fakeExtensionVersion, '', fakeUserId, 'test-webUser', false);
      appInsights.orgIdentity = { devHubId: '', orgId: dummyOrgId };
      (appInsights as any).userOptIn = true;
      (appInsights as any).appInsightsClient = {
        trackException: trackExceptionMock,
        trackEvent: trackEventMock
      };

      // Act
      appInsights.sendExceptionEvent('Dummy Exception', 'a dummy exception occurred');

      // Assert
      expect(trackExceptionMock).toHaveBeenCalledTimes(1);
      expect(trackExceptionMock.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should omit org properties when orgIdentity is unset', () => {
      appInsights = new AppInsights(fakeExtensionId, fakeExtensionVersion, '', fakeUserId, 'test-webUser', false);
      (appInsights as any).userOptIn = true;
      (appInsights as any).appInsightsClient = {
        trackException: trackExceptionMock,
        trackEvent: trackEventMock
      };

      appInsights.sendTelemetryEvent('No Org Event', {}, {});
      appInsights.sendExceptionEvent('No Org Exception', 'an exception with no org');

      const eventProps = trackEventMock.mock.calls[0][0].properties;
      const exceptionProps = trackExceptionMock.mock.calls[0][0].properties;
      [eventProps, exceptionProps].forEach(props => {
        expect(props.orgId).toBeUndefined();
        expect(props.orgShape).toBeUndefined();
        expect(props.devHubId).toBeUndefined();
      });
    });

    it('should include orgEdition in event properties when available', () => {
      appInsights = new AppInsights(fakeExtensionId, fakeExtensionVersion, '', fakeUserId, 'test-webUser', false);
      appInsights.orgIdentity = { orgId: dummyOrgId, orgShape: 'Production', orgEdition: 'Enterprise Edition' };
      (appInsights as any).userOptIn = true;
      (appInsights as any).appInsightsClient = {
        trackException: trackExceptionMock,
        trackEvent: trackEventMock
      };

      appInsights.sendTelemetryEvent('Test Event', {}, {});

      const eventProps = trackEventMock.mock.calls[0][0].properties;
      expect(eventProps.orgEdition).toBe('Enterprise Edition');
      expect(eventProps.orgId).toBe(dummyOrgId);
    });
  });

  describe('dispose', () => {
    let appInsights: AppInsights;
    const flushMock = vi.fn().mockImplementation((options: { callback: () => void }) => {
      // Simulate flush completion by calling the callback immediately
      options.callback();
    });
    const appInsightsClientMock = {
      flush: flushMock
    };

    beforeEach(() => {
      appInsights = new AppInsights(fakeExtensionId, fakeExtensionVersion, 'aKey', fakeUserId, 'test-webUser', false);
      (appInsights as any).appInsightsClient = appInsightsClientMock;
    });

    it('should flush events to appInsightsClient and resolve', async () => {
      // Ensure the mock implementation is properly set for this test
      flushMock.mockImplementation((options: { callback: () => void }) => {
        options.callback();
      });

      const disposePromise = appInsights.dispose();

      expect(flushMock).toHaveBeenCalledTimes(1);
      expect(disposePromise).toBeInstanceOf(Promise);
      await expect(disposePromise).resolves.toBeUndefined();
    });

    it('should resolve immediately if appInsightsClient is undefined', async () => {
      (appInsights as any).appInsightsClient = undefined;

      const disposePromise = appInsights.dispose();

      expect(disposePromise).toBeInstanceOf(Promise);
      await expect(disposePromise).resolves.toBeUndefined();
    });
  });

  describe('AppInsights - getCommonProperties', () => {
    let commonProperties: CommonProperties;

    beforeEach(() => {
      commonProperties = getCommonProperties(fakeExtensionId, fakeExtensionVersion);
    });

    it('should return common system properties', () => {
      expect(typeof commonProperties).toBe('object');
    });

    it('should return extname that was passed in params', () => {
      expect(commonProperties['common.extname']).toBe(fakeExtensionId);
    });

    it('should return extVersion passed in params', () => {
      expect(commonProperties['common.extversion']).toBe(fakeExtensionVersion);
    });
  });

  describe('AppInsights - getInternalProperties', () => {
    let internalProperties: InternalProperties;

    beforeEach(() => {
      internalProperties = getInternalProperties();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return internal properties', () => {
      expect(typeof internalProperties).toBe('object');
    });

    it('should return hostname', () => {
      expect(internalProperties['sfInternal.hostname']).toBe(os.hostname());
    });

    it('should return username', () => {
      expect(internalProperties['sfInternal.username']).toBe(os.userInfo().username);
    });
  });

  describe('AppInsights - aggregateLoggingProperties', () => {
    let appInsights: AppInsights;

    beforeEach(() => {
      vi.mocked(isInternalHost).mockReturnValue(true);
      appInsights = new AppInsights(fakeExtensionId, fakeExtensionVersion, fakeKey, fakeUserId, 'test-webUser', false);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return properties', () => {
      expect(typeof appInsights['aggregateLoggingProperties']()).toBe('object');
    });

    it('should return common and internal properties when is internal user', () => {
      const commonProps = getCommonProperties(fakeExtensionId, fakeExtensionVersion);
      const internalProps = getInternalProperties();
      const result = appInsights['aggregateLoggingProperties']();
      expect(result).toEqual({ ...commonProps, ...internalProps, webUserId: 'test-webUser' });
    });

    it('should return common properties when is not internal user', () => {
      vi.mocked(isInternalHost).mockReturnValue(false);
      const commonProps = getCommonProperties(fakeExtensionId, fakeExtensionVersion);
      const result = appInsights['aggregateLoggingProperties']();
      expect(result).toEqual({ ...commonProps, webUserId: 'test-webUser' });
    });
  });
});
