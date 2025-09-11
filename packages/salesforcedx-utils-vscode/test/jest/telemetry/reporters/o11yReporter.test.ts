/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { O11yService } from '@salesforce/o11y-reporter';
import { workspace } from 'vscode';
import { WorkspaceContextUtil } from '../../../../src/context/workspaceContextUtil';
import { O11yReporter } from '../../../../src/telemetry/reporters/o11yReporter';

describe('O11yReporter', () => {
  const fakeExtensionId = 'anExtensionId';
  const fakeEndpoint = 'https://o11y.salesforce.com/upload';
  const fakeExtensionVersion = '1.0.0';
  const fakeUserId = 'test-user-id'; // Provide a test user ID
  const dummyOrgId = '00Dxx0000001gPFEAY';

  let sendMock: jest.Mock;
  let uploadMock: jest.Mock;
  let o11yReporter: O11yReporter;

  beforeEach(() => {
    // Mock WorkspaceContextUtil
    jest.spyOn(WorkspaceContextUtil, 'getInstance').mockReturnValue({
      orgId: dummyOrgId,
      orgShape: 'ScratchOrg',
      devHubId: '00Dxx0000001gPHFAU'
    } as any);

    // Mock O11yService
    sendMock = jest.fn();
    uploadMock = jest.fn();

    jest.spyOn(O11yService, 'getInstance').mockReturnValue({
      logEvent: sendMock, // Now mocks logEvent correctly
      upload: uploadMock // Also mocks upload to prevent dispose failure
    } as any);

    // Mock workspace config for telemetry tag
    jest.spyOn(workspace, 'getConfiguration').mockReturnValue({
      get: jest.fn().mockReturnValue('testTelemetryTag')
    } as any);

    o11yReporter = new O11yReporter(fakeExtensionId, fakeExtensionVersion, fakeEndpoint, fakeUserId, 'test-webUser');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendTelemetryEvent', () => {
    it('should send telemetry event with properties and measurements', () => {
      const eventName = 'testEvent';
      const properties = { foo: 'bar' };
      const measurements = { value: 42 };

      o11yReporter.sendTelemetryEvent(eventName, properties, measurements);

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledTimes(1);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const [callArg] = sendMock.mock.calls[0]; // ← Destructure the first call

      expect(callArg).toMatchObject({
        name: `${fakeExtensionId}/${eventName}`,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        properties: expect.objectContaining({
          foo: 'bar',
          orgId: '00Dxx0000001gPFEAY',
          orgShape: 'ScratchOrg',
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
          orgShape: 'ScratchOrg',
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
  });

  describe('dispose', () => {
    it('should resolve without errors', async () => {
      await expect(o11yReporter.dispose()).resolves.not.toThrow();
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
