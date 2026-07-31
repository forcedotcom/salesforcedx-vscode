/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { O11yService } from '@salesforce/o11y-reporter';
import * as Effect from 'effect/Effect';
import { workspace } from 'vscode';
import { O11yReporter } from '../../../../src/telemetry/reporters/o11yReporter';

// getConnection is a module thunk resolving the services api lazily; mocking the api is the only way to reach it.
const mockGetConnectionSvc = jest.fn();

jest.mock('@salesforce/effect-ext-utils', () => {
  const E = require('effect/Effect');
  const Ctx = require('effect/Context');
  return {
    getServicesApi: E.succeed({
      services: {
        prebuiltServicesDependencies: Ctx.empty(),
        ConnectionService: {
          getConnection: (...args: unknown[]) => mockGetConnectionSvc(...args)
        }
      }
    })
  };
});

describe('O11yReporter', () => {
  const fakeExtensionId = 'anExtensionId';
  const fakeEndpoint = 'https://o11y.salesforce.com/upload';
  const fakeExtensionVersion = '1.0.0';
  const fakeUserId = 'test-user-id'; // Provide a test user ID
  const dummyOrgId = '00Dxx0000001gPFEAY';

  let sendMock: jest.Mock;
  let uploadMock: jest.Mock;
  let forceFlushMock: jest.Mock;
  let enableAutoBatchingMock: jest.Mock;
  let o11yReporter: O11yReporter;

  beforeEach(() => {
    // Mock O11yService
    sendMock = jest.fn();
    uploadMock = jest.fn();
    forceFlushMock = jest.fn().mockResolvedValue(undefined);
    enableAutoBatchingMock = jest.fn().mockReturnValue(() => {
      // Return a cleanup function
    });

    jest.spyOn(O11yService, 'getInstance').mockReturnValue({
      logEvent: sendMock,
      upload: uploadMock,
      forceFlush: forceFlushMock,
      enableAutoBatching: enableAutoBatchingMock,
      initialize: jest.fn().mockResolvedValue(undefined)
    } as any);

    // Mock workspace config for telemetry tag
    jest.spyOn(workspace, 'getConfiguration').mockReturnValue({
      get: jest.fn().mockReturnValue('testTelemetryTag')
    } as any);

    o11yReporter = new O11yReporter(fakeExtensionId, fakeExtensionVersion, fakeEndpoint, fakeUserId, 'test-webUser');
    o11yReporter.orgIdentity = {
      orgId: dummyOrgId,
      orgShape: 'Scratch',
      devHubId: '00Dxx0000001gPHFAU'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should call o11yService.initialize with extensionName, endpoint, and getConnection', async () => {
      const initializeMock = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(O11yService, 'getInstance').mockReturnValue({
        logEvent: sendMock,
        upload: uploadMock,
        forceFlush: forceFlushMock,
        enableAutoBatching: enableAutoBatchingMock,
        initialize: initializeMock
      } as any);

      const reporter = new O11yReporter(
        fakeExtensionId,
        fakeExtensionVersion,
        fakeEndpoint,
        fakeUserId,
        'test-webUser'
      );

      await reporter.initialize('test-extension');

      expect(initializeMock).toHaveBeenCalledTimes(1);
      expect(initializeMock).toHaveBeenCalledWith('test-extension', fakeEndpoint, expect.any(Function));
      expect(enableAutoBatchingMock).toHaveBeenCalledWith(
        expect.objectContaining({ flushInterval: 30_000, enableShutdownHook: true })
      );
    });

    it('getConnection thunk re-resolves current org per call', async () => {
      const initializeMock = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(O11yService, 'getInstance').mockReturnValue({
        logEvent: sendMock,
        upload: uploadMock,
        forceFlush: forceFlushMock,
        enableAutoBatching: enableAutoBatchingMock,
        initialize: initializeMock
      } as any);

      const reporter = new O11yReporter(
        fakeExtensionId,
        fakeExtensionVersion,
        fakeEndpoint,
        fakeUserId,
        'test-webUser'
      );

      await reporter.initialize('test-extension');

      const mockConn = { instanceUrl: 'https://test.salesforce.com' };
      mockGetConnectionSvc.mockReturnValue(Effect.succeed(mockConn));

      const thunk = initializeMock.mock.calls[0][2] as () => Promise<unknown>;
      await thunk();
      await thunk();

      // guards DESIGN CONSTRAINT: thunk hits services per call, never captures a resolved Connection at init
      expect(mockGetConnectionSvc).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendTelemetryEvent', () => {
    it('should send telemetry event with properties and measurements', () => {
      const eventName = 'testEvent';
      const properties = { foo: 'bar' };
      const measurements = { value: 42 };

      o11yReporter.sendTelemetryEvent(eventName, properties, measurements);

      expect(sendMock).toHaveBeenCalledTimes(1);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const [callArg] = sendMock.mock.calls[0]; // ← Destructure the first call

      expect(callArg).toMatchObject({
        name: `${fakeExtensionId}/${eventName}`,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        properties: expect.objectContaining({
          foo: 'bar',
          orgId: '00Dxx0000001gPFEAY',
          orgShape: 'Scratch',
          devHubId: '00Dxx0000001gPHFAU',
          telemetryTag: 'testTelemetryTag'
        }),
        measurements: { value: 42 }
      });
    });

    it('should not send telemetry if userOptIn is false', () => {
      (o11yReporter as any).userOptIn = false;

      o11yReporter.sendTelemetryEvent('noSendEvent');

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('should not throw when logEvent fails', () => {
      const error = new Error('send failed');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      sendMock.mockImplementation(() => {
        throw error;
      });

      expect(() => o11yReporter.sendTelemetryEvent('testEvent')).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith('O11yReporter logEvent failed:', error);
    });
  });

  describe('sendExceptionEvent', () => {
    it('should send exception telemetry with properties and measurements', () => {
      const exceptionName = 'TestException';
      const exceptionMessage = 'Something went wrong';
      const measurements = { duration: 100 };

      o11yReporter.sendExceptionEvent(exceptionName, exceptionMessage, measurements);

      expect(sendMock).toHaveBeenCalledTimes(1);
      const [callArg] = sendMock.mock.calls[0]; // Only 1 argument

      expect(callArg.exception.name).toBe(`${fakeExtensionId}/${exceptionName}`);
      expect(callArg.exception.message).toBe(exceptionMessage);
      expect(callArg.properties).toEqual(
        expect.objectContaining({
          orgId: '00Dxx0000001gPFEAY',
          orgShape: 'Scratch',
          devHubId: '00Dxx0000001gPHFAU',
          telemetryTag: 'testTelemetryTag'
        })
      );
      expect(callArg.measurements).toEqual({ duration: 100 });
    });

    it('should not send exception if userOptIn is false', () => {
      (o11yReporter as any).userOptIn = false;

      o11yReporter.sendExceptionEvent('NoSendException', 'No exception');

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('should not throw when logEvent fails', () => {
      const error = new Error('send failed');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      sendMock.mockImplementation(() => {
        throw error;
      });

      expect(() => o11yReporter.sendExceptionEvent('TestException', 'Something went wrong')).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith('O11yReporter logEvent(exception) failed:', error);
    });
  });

  describe('dispose', () => {
    it('should resolve without errors', async () => {
      await expect(o11yReporter.dispose()).resolves.not.toThrow();
    });

    it('should resolve when forceFlush fails', async () => {
      const error = new Error('flush failed');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      forceFlushMock.mockRejectedValue(error);

      await expect(o11yReporter.dispose()).resolves.toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith('O11yReporter forceFlush failed:', error);
    });
  });

  describe('telemetryTag handling', () => {
    it('should include telemetryTag in sent properties', () => {
      o11yReporter.sendTelemetryEvent('testTagEvent');

      const callArg = sendMock.mock.calls[0][0];
      expect(callArg.properties).toHaveProperty('telemetryTag', 'testTelemetryTag');
    });

    it('should not include telemetryTag if not set', () => {
      // Override workspace config to return undefined for telemetryTag
      jest.spyOn(workspace, 'getConfiguration').mockReturnValue({
        get: jest.fn().mockReturnValue(undefined)
      } as any);

      const reporterWithoutTag = new O11yReporter(
        fakeExtensionId,
        fakeExtensionVersion,
        fakeEndpoint,
        fakeUserId,
        'test-webUser'
      );
      sendMock.mockClear();

      reporterWithoutTag.sendTelemetryEvent('eventWithoutTag');

      const callArg = sendMock.mock.calls[0][0];
      expect(callArg.properties).not.toHaveProperty('telemetryTag');
    });
  });
});
