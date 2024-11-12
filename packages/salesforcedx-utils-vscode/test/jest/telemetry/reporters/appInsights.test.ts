/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { workspace } from 'vscode';
import { WorkspaceContextUtil } from '../../../../src';
import { AppInsights } from '../../../../src/telemetry/reporters/appInsights';
import { CommonProperties, InternalProperties } from '../../../../src/telemetry/reporters/loggingProperties';

describe('AppInsights', () => {
  const fakeExtensionId = 'anExtensionId';
  const fakeExtensionVersion = '0.10.0';
  const fakeUserId = '45gkjnbxsbchdnv34sbcishsm';
  const fakeKey = 'testKey';

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
        .mockReturnValue({ devHubId: '', orgId: dummyOrgId, orgShape: '' } as any);

      jest.spyOn(workspace, 'getConfiguration').mockReturnValue(fakeConfig);
      jest.spyOn(AppInsights.prototype as any, 'updateUserOptIn').mockReturnValue('');
    });

    it('should send telemetry data to appInsightsClient.trackEvent', () => {
      appInsights = new AppInsights(fakeExtensionId, fakeExtensionVersion, '', fakeUserId, false);
      (appInsights as any).userOptIn = true;
      (appInsights as any).appInsightsClient = {
        trackException: trackExceptionMock,
        trackEvent: trackEventMock
      };

      // Act
      appInsights.sendTelemetryEvent('Dummy Telemetry Event', {}, {});

      // Assert
      expect(getInstanceMock).toHaveBeenCalledTimes(3);
      expect(trackEventMock).toHaveBeenCalledTimes(1);
      expect(trackEventMock.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should send orgId to appInsightsClient.trackException', () => {
      // Act
      appInsights.sendExceptionEvent('Dummy Exception', 'a dummy exception occurred');

      // Assert
      expect(getInstanceMock).toHaveBeenCalledTimes(3);
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
      appInsights = new AppInsights(fakeExtensionId, fakeExtensionVersion, 'aKey', fakeUserId, false);
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

  describe('AppInsights - getCommonProperties', () => {
    let appInsights: AppInsights;
    let commonProperties: CommonProperties;

    beforeEach(() => {
      appInsights = new AppInsights(fakeExtensionId, fakeExtensionVersion, fakeKey, fakeUserId, false);
      commonProperties = appInsights['getCommonProperties']();
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
    let appInsights: AppInsights;
    let internalProperties: InternalProperties;

    beforeEach(() => {
      jest.spyOn(os, 'hostname').mockReturnValue('test.internal.salesforce.com');
      jest.spyOn(os, 'userInfo').mockReturnValue({
        username: 'testuser',
        uid: 1001,
        gid: 1001,
        shell: '/bin/bash',
        homedir: '/home/testuser'
      });
      appInsights = new AppInsights(fakeExtensionId, fakeExtensionVersion, fakeKey, fakeUserId, false);
      internalProperties = appInsights['getInternalProperties']();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should return internal properties', () => {
      expect(typeof internalProperties).toBe('object');
    });

    it('should return hostname', () => {
      expect(internalProperties['sfInternal.hostname']).toBe('test.internal.salesforce.com');
    });

    it('should return username', () => {
      expect(internalProperties['sfInternal.username']).toBe('testuser');
    });
  });

  describe('AppInsights - aggregateLoggingProperties', () => {
    let appInsights: AppInsights;

    beforeEach(() => {
      jest.spyOn(os, 'hostname').mockReturnValue('test.internal.salesforce.com');
      jest.spyOn(os, 'cpus').mockReturnValue([
        {
          model: 'AMD EPYC 7763 64-Core Processor',
          speed: 3242,
          times: {
            user: 100000,
            nice: 0,
            sys: 100000,
            idle: 1000000,
            irq: 0
          }
        }
      ]);
      jest.spyOn(os, 'userInfo').mockReturnValue({
        username: 'testuser',
        uid: 1001,
        gid: 1001,
        shell: '/bin/bash',
        homedir: '/home/testuser'
      });
      appInsights = new AppInsights(fakeExtensionId, fakeExtensionVersion, fakeKey, fakeUserId, false);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should return properties', () => {
      expect(typeof appInsights['aggregateLoggingProperties']()).toBe('object');
    });

    it('should return common and internal properties when is internal user', () => {
      const commonProps = appInsights['getCommonProperties']();
      const internalProps = appInsights['getInternalProperties']();
      const result = appInsights['aggregateLoggingProperties']();
      expect(result).toEqual({ ...commonProps, ...internalProps });
    });

    it('should return common properties when is not internal user', () => {
      jest.spyOn(os, 'hostname').mockReturnValue('test.salesforce.com');
      const commonProps = appInsights['getCommonProperties']();
      const result = appInsights['aggregateLoggingProperties']();
      expect(result).toEqual(commonProps);
    });
  });
});
