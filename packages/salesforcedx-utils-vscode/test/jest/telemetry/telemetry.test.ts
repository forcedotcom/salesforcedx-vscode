/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { workspace } from 'vscode';
import { TelemetryService, TelemetryServiceInterface } from '../../../src';
import { SFDX_CORE_EXTENSION_NAME } from '../../../src/constants';
import { TelemetryServiceProvider } from '../../../src/services/telemetry';

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
    const mockedWorkspace = jest.mocked(workspace);
    let instance: TelemetryServiceInterface;

    const mockConfiguration = {
      get: jest.fn().mockReturnValue('true')
    };

    beforeEach(() => {
      jest.spyOn(mockedWorkspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);
      instance = TelemetryService.getInstance();
    });

    afterEach(() => {
      jest.clearAllMocks();
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
    let spyIsTelemetryExtensionConfigurationEnabled: jest.SpyInstance;
    let instance: TelemetryServiceInterface;

    beforeEach(() => {
      spyIsTelemetryExtensionConfigurationEnabled = jest.spyOn(
        TelemetryService.prototype,
        'isTelemetryExtensionConfigurationEnabled'
      );
      instance = TelemetryService.getInstance();
    });

    afterEach(() => {
      jest.clearAllMocks();
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
    let mockReporter: any;

    beforeEach(() => {
      // Clear instances to get fresh instance
      TelemetryServiceProvider.instances.clear();
      instance = TelemetryServiceProvider.getInstance() as TelemetryService;

      // Mock reporters to avoid actual telemetry sends
      mockReporter = {
        sendTelemetryEvent: jest.fn(),
        sendExceptionEvent: jest.fn(),
        sendEventData: jest.fn(),
        dispose: jest.fn()
      };

      // Replace the reporters array with our mock
      (instance as any).reporters = [mockReporter];

      // Set the extension name properly for testing
      (instance as any).extensionName = 'salesforcedx-vscode-core';

      // Enable telemetry for testing by mocking the validation method to call the callback directly
      (instance as any).validateTelemetry = jest.fn((callback: () => void) => {
        callback(); // Call immediately for testing
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
      TelemetryServiceProvider.instances.clear();
    });

    describe('sendExtensionActivationEvent timing parameter compatibility', () => {
      it('should work with number startTime (new format)', () => {
        // Use a recent timestamp that won't cause negative time issues
        const startTime = Date.now() - 50; // 50ms ago

        expect(() => {
          instance.sendExtensionActivationEvent(startTime);
        }).not.toThrow();

        expect(mockReporter.sendTelemetryEvent).toHaveBeenCalledWith(
          'activationEvent',
          expect.objectContaining({ extensionName: 'salesforcedx-vscode-core' }),
          expect.objectContaining({ startupTime: expect.any(Number) })
        );
      });

      it('should work with hrtime tuple startTime (legacy format)', () => {
        // Create a valid hrtime tuple representing 50ms ago
        const now = Date.now();
        const fiftyMsAgo = now - 50;
        const hrtime: [number, number] = [Math.floor(fiftyMsAgo / 1000), (fiftyMsAgo % 1000) * 1000000];

        expect(() => {
          instance.sendExtensionActivationEvent(hrtime);
        }).not.toThrow();

        expect(mockReporter.sendTelemetryEvent).toHaveBeenCalledWith(
          'activationEvent',
          expect.objectContaining({ extensionName: 'salesforcedx-vscode-core' }),
          expect.objectContaining({ startupTime: expect.any(Number) })
        );
      });

      it('should work with undefined startTime', () => {
        expect(() => {
          instance.sendExtensionActivationEvent(undefined, 100);
        }).not.toThrow();

        expect(mockReporter.sendTelemetryEvent).toHaveBeenCalledWith(
          'activationEvent',
          expect.objectContaining({ extensionName: 'salesforcedx-vscode-core' }),
          expect.objectContaining({ startupTime: 100 })
        );
      });

      it('should use markEndTime when provided, regardless of startTime format', () => {
        const startTime = Date.now() - 50;
        const markEndTime = 250;

        instance.sendExtensionActivationEvent(startTime, markEndTime);

        expect(mockReporter.sendTelemetryEvent).toHaveBeenCalledWith(
          'activationEvent',
          expect.objectContaining({ extensionName: 'salesforcedx-vscode-core' }),
          expect.objectContaining({ startupTime: markEndTime })
        );
      });
    });

    describe('sendCommandEvent timing parameter compatibility', () => {
      it('should work with number startTime (new format)', () => {
        const startTime = Date.now() - 50; // 50ms ago

        expect(() => {
          instance.sendCommandEvent('test_command', startTime, { testProp: 'value' });
        }).not.toThrow();

        expect(mockReporter.sendTelemetryEvent).toHaveBeenCalledWith(
          'commandExecution',
          expect.objectContaining({
            extensionName: 'salesforcedx-vscode-core',
            commandName: 'test_command',
            testProp: 'value'
          }),
          expect.objectContaining({ executionTime: expect.any(Number) })
        );
      });

      it('should work with hrtime tuple startTime (legacy format)', () => {
        // Create a valid hrtime tuple representing 50ms ago
        const now = Date.now();
        const fiftyMsAgo = now - 50;
        const hrtime: [number, number] = [Math.floor(fiftyMsAgo / 1000), (fiftyMsAgo % 1000) * 1000000];

        expect(() => {
          instance.sendCommandEvent('test_command', hrtime, { testProp: 'value' });
        }).not.toThrow();

        expect(mockReporter.sendTelemetryEvent).toHaveBeenCalledWith(
          'commandExecution',
          expect.objectContaining({
            extensionName: 'salesforcedx-vscode-core',
            commandName: 'test_command',
            testProp: 'value'
          }),
          expect.objectContaining({ executionTime: expect.any(Number) })
        );
      });

      it('should work with undefined startTime', () => {
        expect(() => {
          instance.sendCommandEvent('test_command', undefined, { testProp: 'value' });
        }).not.toThrow();

        expect(mockReporter.sendTelemetryEvent).toHaveBeenCalledWith(
          'commandExecution',
          expect.objectContaining({
            extensionName: 'salesforcedx-vscode-core',
            commandName: 'test_command',
            testProp: 'value'
          }),
          // No executionTime measurement when startTime is undefined
          expect.not.objectContaining({ executionTime: expect.any(Number) })
        );
      });

      it('should include measurements when provided with timing', () => {
        const startTime = Date.now() - 50;
        const measurements = { customMetric: 42 };

        instance.sendCommandEvent('test_command', startTime, { testProp: 'value' }, measurements);

        expect(mockReporter.sendTelemetryEvent).toHaveBeenCalledWith(
          'commandExecution',
          expect.objectContaining({
            extensionName: 'salesforcedx-vscode-core',
            commandName: 'test_command',
            testProp: 'value'
          }),
          expect.objectContaining({
            executionTime: expect.any(Number),
            customMetric: 42
          })
        );
      });
    });

    describe('convertTimingToNumber helper method', () => {
      it('should convert number correctly', () => {
        const startTime = Date.now();
        const result = (instance as any).convertTimingToNumber(startTime);
        expect(result).toBe(startTime);
      });

      it('should convert hrtime tuple correctly', () => {
        const hrtime: [number, number] = [1000, 500000000]; // 1000 seconds + 500ms
        const result = (instance as any).convertTimingToNumber(hrtime);
        expect(result).toBe(1000500); // 1000 seconds * 1000 + 500ms
      });

      it('should handle undefined correctly', () => {
        const result = (instance as any).convertTimingToNumber(undefined);
        expect(result).toBeUndefined();
      });

      it('should warn and return undefined for invalid formats', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const result = (instance as any).convertTimingToNumber('invalid' as any);
        expect(result).toBeUndefined();
        expect(consoleSpy).toHaveBeenCalledWith('Invalid timing format provided:', 'invalid');

        consoleSpy.mockRestore();
      });

      it('should handle malformed arrays correctly', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const result = (instance as any).convertTimingToNumber([1, 2, 3] as any);
        expect(result).toBeUndefined();
        expect(consoleSpy).toHaveBeenCalledWith('Invalid timing format provided:', [1, 2, 3]);

        consoleSpy.mockRestore();
      });
    });
  });
});
