/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import type { MockInstance as VitestMockInstance } from 'vitest';
import { TelemetryServiceInterface } from '@salesforce/vscode-service-provider';
import { ExtensionContext, workspace } from 'vscode';
import { SFDX_CORE_EXTENSION_NAME } from '../../../src/constants';
import { TelemetryService, TelemetryServiceProvider } from '../../../src/services/telemetry';

describe('Telemetry', () => {
  describe('Telemetry Service Provider', () => {
    afterEach(() => {
      // Clear instances after each test to avoid state leakage.
      TelemetryServiceProvider.instances.clear();
    });
    it('getInstance should return a TelemetryService instance for core extension when no name is provided', () => {
      const instance = TelemetryServiceProvider.getInstance();
      expect(instance).toBeInstanceOf(TelemetryService);
      expect(TelemetryServiceProvider.instances.has(SFDX_CORE_EXTENSION_NAME)).toBeTruthy();
    });

    it('getInstance should return the same TelemetryService instance for core extension on subsequent calls', () => {
      const firstInstance = TelemetryServiceProvider.getInstance();
      const secondInstance = TelemetryServiceProvider.getInstance();
      expect(secondInstance).toBe(firstInstance);
    });

    it('getInstance should return a TelemetryService instance for a named extension', () => {
      const extensionName = 'someExtension';
      const instance = TelemetryServiceProvider.getInstance(extensionName);
      expect(instance).toBeInstanceOf(TelemetryService);
      expect(TelemetryServiceProvider.instances.has(extensionName)).toBeTruthy();
    });

    it('getInstance should return the same TelemetryService instance for a named extension on subsequent calls', () => {
      const extensionName = 'someExtension';
      const firstInstance = TelemetryServiceProvider.getInstance(extensionName);
      const secondInstance = TelemetryServiceProvider.getInstance(extensionName);
      expect(secondInstance).toBe(firstInstance);
    });

    it('getInstance should return different instances for different extension names', () => {
      const firstExtensionName = 'extensionOne';
      const secondExtensionName = 'extensionTwo';
      const firstInstance = TelemetryServiceProvider.getInstance(firstExtensionName);
      const secondInstance = TelemetryServiceProvider.getInstance(secondExtensionName);
      expect(firstInstance).not.toBe(secondInstance);
    });
  });

  describe('Telemetry Service - getInstance', () => {
    it('getInstance should return the core instance if no extension name provided', () => {
      const firstInstance = TelemetryService.getInstance();
      const secondInstance = TelemetryServiceProvider.getInstance(SFDX_CORE_EXTENSION_NAME);
      expect(firstInstance).toBe(secondInstance);
    });
    it('getInstance should return the same TelemetryService instance for a named extension on subsequent calls', () => {
      const extensionName = 'someExtension';
      const firstInstance = TelemetryService.getInstance(extensionName);
      const secondInstance = TelemetryServiceProvider.getInstance(extensionName);
      expect(secondInstance).toBe(firstInstance);
    });
  });
  describe('Telemetry Service - isTelemetryExtensionConfigurationEnabled', () => {
    const mockedWorkspace = vi.mocked(workspace);
    let instance: TelemetryServiceInterface;

    const mockConfiguration = {
      get: vi.fn().mockReturnValue('true')
    };

    beforeEach(() => {
      vi.spyOn(mockedWorkspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);
      instance = TelemetryService.getInstance();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it.each([
      ['all', true, true],
      ['off', true, false],
      ['all', false, false],
      ['off', false, false]
    ])(
      'should return true if telemetryLevel is %s and SFDX_CORE_CONFIGURATION_NAME.telemetry.enabled is %s',
      (firstReturnValue, secondReturnValue, expectedResult) => {
        mockConfiguration.get.mockReturnValueOnce(firstReturnValue);
        mockConfiguration.get.mockReturnValueOnce(secondReturnValue);

        const result = instance.isTelemetryExtensionConfigurationEnabled();

        expect(result).toBe(expectedResult);
      }
    );
  });
  describe('Telemetry Service - isTelemetryEnabled', () => {
    let spyIsTelemetryExtensionConfigurationEnabled: VitestMockInstance;
    let instance: TelemetryServiceInterface;

    beforeEach(() => {
      spyIsTelemetryExtensionConfigurationEnabled = vi.spyOn(
        TelemetryService.prototype,
        'isTelemetryExtensionConfigurationEnabled'
      );
      instance = TelemetryService.getInstance();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    const changeTelemetryServiceProperty = (ts: TelemetryServiceInterface, propertyName: string, value: any) => {
      Object.defineProperty(ts, propertyName, {
        value
      });
    };

    it('should return true when isTelemetryExtensionConfigurationEnabled and checkCliTelemetry are true', async () => {
      spyIsTelemetryExtensionConfigurationEnabled.mockReturnValue(true);
      changeTelemetryServiceProperty(
        TelemetryServiceProvider.getInstance(),
        'cliAllowsTelemetryPromise',
        Promise.resolve(true)
      );
      expect(await instance.isTelemetryEnabled()).toBe(true);
    });

    it('should return false when isTelemetryExtensionConfigurationEnabled and checkCliTelemetry are false', async () => {
      spyIsTelemetryExtensionConfigurationEnabled.mockReturnValue(false);
      changeTelemetryServiceProperty(instance, 'cliAllowsTelemetryPromise', Promise.resolve(false));
      expect(await instance.isTelemetryEnabled()).toBe(false);
    });

    it('should return false when isTelmetryExtensionConfigurationEnabled is false and checkCliTelemetry is true', async () => {
      spyIsTelemetryExtensionConfigurationEnabled.mockReturnValue(false);
      changeTelemetryServiceProperty(instance, 'cliAllowsTelemetryPromise', Promise.resolve(true));
      expect(await instance.isTelemetryEnabled()).toBe(false);
    });

    it('should return false when isTelmetryExtensionConfigurationEnabled is true and checkCliTelemetry is false', async () => {
      spyIsTelemetryExtensionConfigurationEnabled.mockReturnValue(true);
      changeTelemetryServiceProperty(instance, 'cliAllowsTelemetryPromise', Promise.resolve(false));
      expect(await instance.isTelemetryEnabled()).toBe(false);
    });

    it('should return true when internal user', async () => {
      changeTelemetryServiceProperty(instance, 'isInternal', true);
      expect(await instance.isTelemetryEnabled()).toBe(true);
    });

    it('should return true when not internal user, isTelemetryExtensionConfigurationEnabled is true and checkCliTelemetry is true', async () => {
      changeTelemetryServiceProperty(instance, 'isInternal', false);
      spyIsTelemetryExtensionConfigurationEnabled.mockReturnValue(true);
      changeTelemetryServiceProperty(instance, 'cliAllowsTelemetryPromise', Promise.resolve(true));
      expect(await instance.isTelemetryEnabled()).toBe(true);
    });

    it('should return false when not internal user, isTelemetryExtensionConfigurationEnabled is false and checkCliTelemetry is false', async () => {
      changeTelemetryServiceProperty(instance, 'isInternal', false);
      spyIsTelemetryExtensionConfigurationEnabled.mockReturnValue(false);
      changeTelemetryServiceProperty(instance, 'cliAllowsTelemetryPromise', Promise.resolve(false));
      expect(await instance.isTelemetryEnabled()).toBe(false);
    });

    it('should return false when not internal user, isTelemetryExtensionConfigurationEnabled is false and checkCliTelemetry is true', async () => {
      changeTelemetryServiceProperty(instance, 'isInternal', false);
      spyIsTelemetryExtensionConfigurationEnabled.mockReturnValue(false);
      changeTelemetryServiceProperty(instance, 'cliAllowsTelemetryPromise', Promise.resolve(true));
      expect(await instance.isTelemetryEnabled()).toBe(false);
    });

    it('should return false when not internal user, isTelemetryExtensionConfigurationEnabled is true and checkCliTelemetry is false', async () => {
      changeTelemetryServiceProperty(instance, 'isInternal', false);
      spyIsTelemetryExtensionConfigurationEnabled.mockReturnValue(true);
      changeTelemetryServiceProperty(instance, 'cliAllowsTelemetryPromise', Promise.resolve(false));
      expect(await instance.isTelemetryEnabled()).toBe(false);
    });
  });

  describe('Telemetry Service - Backwards Compatibility', () => {
    let instance: TelemetryService;
    let senderMock: ReturnType<typeof vi.fn>;
    let preparedSenderMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      // Clear instances to get fresh instance
      TelemetryServiceProvider.instances.clear();
      instance = TelemetryServiceProvider.getInstance() as TelemetryService;

      // Mock production sender to avoid actual telemetry sends
      preparedSenderMock = vi.fn().mockResolvedValue(undefined);
      senderMock = vi.fn().mockReturnValue(preparedSenderMock);
      (instance as any).sendProductionTelemetry = senderMock;

      // Set the extension name properly for testing
      (instance as any).extensionName = 'salesforcedx-vscode-core';

      vi.spyOn(instance, 'isTelemetryEnabled').mockResolvedValue(true);
    });

    afterEach(() => {
      vi.clearAllMocks();
      TelemetryServiceProvider.instances.clear();
    });

    describe('sendExtensionActivationEvent timing parameter compatibility', () => {
      const lastPayload = (): any => senderMock.mock.calls.at(-1)?.[0];

      it('should work with number startTime (new format)', () => {
        // Use a recent timestamp that won't cause negative time issues
        const startTime = Date.now() - 50; // 50ms ago

        expect(() => {
          instance.sendExtensionActivationEvent(startTime);
        }).not.toThrow();

        const payload = lastPayload();
        expect(payload.name).toBe('activationEvent');
        expect(payload.properties).toEqual(expect.objectContaining({ extensionName: 'salesforcedx-vscode-core' }));
        expect(payload.measurements).toEqual(expect.objectContaining({ startupTime: expect.any(Number) }));
      });

      it('should work with hrtime tuple startTime (legacy format)', () => {
        // Create a valid hrtime tuple representing 50ms ago
        const now = Date.now();
        const fiftyMsAgo = now - 50;
        const hrtime: [number, number] = [Math.floor(fiftyMsAgo / 1000), (fiftyMsAgo % 1000) * 1_000_000];

        expect(() => {
          instance.sendExtensionActivationEvent(hrtime);
        }).not.toThrow();

        const payload = lastPayload();
        expect(payload.name).toBe('activationEvent');
        expect(payload.properties).toEqual(expect.objectContaining({ extensionName: 'salesforcedx-vscode-core' }));
        expect(payload.measurements).toEqual(expect.objectContaining({ startupTime: expect.any(Number) }));
      });

      it('should work with undefined startTime', () => {
        expect(() => {
          instance.sendExtensionActivationEvent(undefined, 100);
        }).not.toThrow();

        const payload = lastPayload();
        expect(payload.name).toBe('activationEvent');
        expect(payload.properties).toEqual(expect.objectContaining({ extensionName: 'salesforcedx-vscode-core' }));
        expect(payload.measurements).toEqual(expect.objectContaining({ startupTime: 100 }));
      });

      it('should use markEndTime when provided, regardless of startTime format', () => {
        const startTime = Date.now() - 50;
        const markEndTime = 250;

        instance.sendExtensionActivationEvent(startTime, markEndTime);

        const payload = lastPayload();
        expect(payload.name).toBe('activationEvent');
        expect(payload.properties).toEqual(expect.objectContaining({ extensionName: 'salesforcedx-vscode-core' }));
        expect(payload.measurements).toEqual(expect.objectContaining({ startupTime: markEndTime }));
      });
    });

    describe('sendCommandEvent timing parameter compatibility', () => {
      const lastPayload = (): any => senderMock.mock.calls.at(-1)?.[0];

      it('should work with number startTime (new format)', () => {
        const startTime = Date.now() - 50; // 50ms ago

        expect(() => {
          instance.sendCommandEvent('test_command', startTime, { testProp: 'value' });
        }).not.toThrow();

        const payload = lastPayload();
        expect(payload.name).toBe('commandExecution');
        expect(payload.properties).toEqual(
          expect.objectContaining({
            extensionName: 'salesforcedx-vscode-core',
            commandName: 'test_command',
            testProp: 'value'
          })
        );
        expect(payload.measurements).toEqual(expect.objectContaining({ executionTime: expect.any(Number) }));
      });

      it('should work with hrtime tuple startTime (legacy format)', () => {
        // Create a valid hrtime tuple representing 50ms ago
        const now = Date.now();
        const fiftyMsAgo = now - 50;
        const hrtime: [number, number] = [Math.floor(fiftyMsAgo / 1000), (fiftyMsAgo % 1000) * 1_000_000];

        expect(() => {
          instance.sendCommandEvent('test_command', hrtime, { testProp: 'value' });
        }).not.toThrow();

        const payload = lastPayload();
        expect(payload.name).toBe('commandExecution');
        expect(payload.properties).toEqual(
          expect.objectContaining({
            extensionName: 'salesforcedx-vscode-core',
            commandName: 'test_command',
            testProp: 'value'
          })
        );
        expect(payload.measurements).toEqual(expect.objectContaining({ executionTime: expect.any(Number) }));
      });

      it('should work with undefined startTime', () => {
        expect(() => {
          instance.sendCommandEvent('test_command', undefined, { testProp: 'value' });
        }).not.toThrow();

        const payload = lastPayload();
        expect(payload.name).toBe('commandExecution');
        expect(payload.properties).toEqual(
          expect.objectContaining({
            extensionName: 'salesforcedx-vscode-core',
            commandName: 'test_command',
            testProp: 'value'
          })
        );
        // No measurements object at all when startTime is undefined and none were passed
        expect(payload.measurements).toBeUndefined();
      });

      it('should include measurements when provided with timing', () => {
        const startTime = Date.now() - 50;
        const measurements = { customMetric: 42 };

        instance.sendCommandEvent('test_command', startTime, { testProp: 'value' }, measurements);

        const payload = lastPayload();
        expect(payload.name).toBe('commandExecution');
        expect(payload.properties).toEqual(
          expect.objectContaining({
            extensionName: 'salesforcedx-vscode-core',
            commandName: 'test_command',
            testProp: 'value'
          })
        );
        expect(payload.measurements).toEqual(
          expect.objectContaining({
            executionTime: expect.any(Number),
            customMetric: 42
          })
        );
      });
    });

    describe('production sender boundary', () => {
      it('dispatches production telemetry', async () => {
        const send = vi.fn().mockResolvedValue(undefined);
        const prepareSend = vi.fn(() => send);
        (instance as any).sendProductionTelemetry = prepareSend;

        instance.sendEventData('event');
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(prepareSend).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledTimes(1);
      });

      it('freezes the event and prepares identity before async telemetry gating', async () => {
        const { promise: telemetryGate, resolve: enableTelemetry } = Promise.withResolvers<boolean>();
        vi.spyOn(instance, 'isTelemetryEnabled').mockReturnValue(telemetryGate);
        const send = vi.fn().mockResolvedValue(undefined);
        const prepareSend = vi.fn((payload: unknown) => send);
        (instance as any).sendProductionTelemetry = prepareSend;
        const properties = { key: 'before' };

        instance.sendEventData('event', properties);
        properties.key = 'after';
        const submittedPayload = prepareSend.mock.calls[0]?.[0] as any;
        expect(submittedPayload.properties).toEqual({ key: 'before' });
        expect(Object.isFrozen(submittedPayload)).toBe(true);
        expect(Object.isFrozen(submittedPayload.properties)).toBe(true);
        expect(submittedPayload).not.toHaveProperty('identity');
        expect(send).not.toHaveBeenCalled();

        enableTelemetry(true);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(send).toHaveBeenCalledTimes(1);
      });
    });

    describe('lifecycle', () => {
      it('registers the service once and direct disposal remains idempotent', async () => {
        const context = {
          extension: { packageJSON: { name: 'test-extension', version: '1.0.0' } },
          extensionMode: 1,
          subscriptions: []
        } as unknown as ExtensionContext;
        vi.spyOn(instance, 'isTelemetryEnabled').mockResolvedValue(false);
        vi.spyOn(instance, 'checkCliTelemetry').mockResolvedValue(false);

        await instance.initializeService(context);
        await instance.initializeService(context);
        expect(context.subscriptions.filter(disposable => disposable === instance)).toHaveLength(1);

        expect(() => {
          instance.dispose();
          instance.dispose();
          context.subscriptions[0]?.dispose();
        }).not.toThrow();
      });
    });

    describe('hrTimeToMilliseconds helper method', () => {
      it('should convert number correctly', () => {
        const startTime = Date.now();
        const result = (instance as any).hrTimeToMilliseconds(startTime);
        expect(result).toBe(startTime);
      });

      it('should convert hrtime tuple correctly', () => {
        const hrtime: [number, number] = [1000, 500_000_000]; // 1000 seconds + 500ms
        const result = (instance as any).hrTimeToMilliseconds(hrtime);
        expect(result).toBe(1_000_500); // 1000 seconds * 1000 + 500ms
      });

      it('should handle undefined by defaulting to [0, 0]', () => {
        const result = (instance as any).hrTimeToMilliseconds(undefined);
        expect(result).toBe(0); // [0, 0] converts to 0 milliseconds
      });
    });

    describe('production sender contract', () => {
      it('commandExecution payload carries commandName for span attribute command', async () => {
        const sendProductionTelemetry = vi.fn().mockReturnValue(vi.fn().mockResolvedValue(undefined));
        (instance as any).sendProductionTelemetry = sendProductionTelemetry;
        instance.sendCommandEvent('myCommand', undefined, { extra: 'x' });
        await new Promise(resolve => setTimeout(resolve, 0));
        const payload = sendProductionTelemetry.mock.calls[0]?.[0] as any;
        expect(payload.name).toBe('commandExecution');
        expect(payload.properties.commandName).toBe('myCommand');
        // services buildLegacySpanAttributes sets attribute command = properties.commandName
        expect(payload.properties.commandName).toBe('myCommand');
      });

      it('exception payload preserves name and message for span', async () => {
        const sendProductionTelemetry = vi.fn().mockReturnValue(vi.fn().mockResolvedValue(undefined));
        (instance as any).sendProductionTelemetry = sendProductionTelemetry;
        instance.sendException('myError', 'boom');
        await new Promise(resolve => setTimeout(resolve, 0));
        const payload = sendProductionTelemetry.mock.calls[0]?.[0] as any;
        expect(payload.kind).toBe('exception');
        expect(payload.name).toBe('myError');
        expect(payload.message).toBe('boom');
      });
    });
  });
});
