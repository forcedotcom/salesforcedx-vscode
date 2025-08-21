/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { workspace } from 'vscode';
import { TelemetryService, TelemetryServiceInterface } from '../../../src';
import { SFDX_CORE_EXTENSION_NAME } from '../../../src/constants';
import { TelemetryServiceProvider } from '../../../src/services/telemetry';

// Mock the dependencies
jest.mock('../../../src/services/userService');
jest.mock('../../../src/telemetry/reporters/determineReporters');

import { getTelemetryUserId } from '../../../src/services/userService';
import { determineReporters, initializeO11yReporter } from '../../../src/telemetry/reporters/determineReporters';

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

    describe('hrTimeToMilliseconds helper method', () => {
      it('should convert number correctly', () => {
        const startTime = Date.now();
        const result = (instance as any).hrTimeToMilliseconds(startTime);
        expect(result).toBe(startTime);
      });

      it('should convert hrtime tuple correctly', () => {
        const hrtime: [number, number] = [1000, 500000000]; // 1000 seconds + 500ms
        const result = (instance as any).hrTimeToMilliseconds(hrtime);
        expect(result).toBe(1000500); // 1000 seconds * 1000 + 500ms
      });

      it('should handle undefined by defaulting to [0, 0]', () => {
        const result = (instance as any).hrTimeToMilliseconds(undefined);
        expect(result).toBe(0); // [0, 0] converts to 0 milliseconds
      });
    });
  });

  describe('Telemetry Service - refreshReporters', () => {
    let instance: TelemetryService;
    let mockExtensionContext: any;
    let mockReporter1: any;
    let mockReporter2: any;
    let mockUserService: jest.SpyInstance;
    let mockDetermineReporters: jest.SpyInstance;
    let mockInitializeO11yReporter: jest.SpyInstance;
    let spyIsTelemetryEnabled: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      // Clear instances to get fresh instance
      TelemetryServiceProvider.instances.clear();
      instance = TelemetryServiceProvider.getInstance() as TelemetryService;

      // Mock extension context
      mockExtensionContext = {
        extension: {
          packageJSON: {
            name: 'test-extension',
            version: '1.0.0',
            o11yUploadEndpoint: 'https://test-endpoint.com',
            enableO11y: 'true'
          }
        },
        subscriptions: []
      };

      // Mock reporters
      mockReporter1 = {
        dispose: jest.fn().mockResolvedValue(undefined)
      };
      mockReporter2 = {
        dispose: jest.fn().mockResolvedValue(undefined)
      };

      // Set up initial state
      (instance as any).extensionContext = mockExtensionContext;
      (instance as any).reporters = [mockReporter1, mockReporter2];
      (instance as any).aiKey = 'test-ai-key';
      (instance as any).isDevMode = false;

      // Mock dependencies
      mockUserService = jest.mocked(getTelemetryUserId).mockResolvedValue('updated-user-id');

      mockDetermineReporters = jest
        .mocked(determineReporters)
        .mockReturnValue([
          { dispose: jest.fn(), sendTelemetryEvent: jest.fn(), sendExceptionEvent: jest.fn() } as any,
          { dispose: jest.fn(), sendTelemetryEvent: jest.fn(), sendExceptionEvent: jest.fn() } as any
        ]);

      mockInitializeO11yReporter = jest.mocked(initializeO11yReporter).mockResolvedValue(undefined);

      spyIsTelemetryEnabled = jest.spyOn(instance, 'isTelemetryEnabled').mockResolvedValue(true);

      jest.spyOn(instance, 'getTelemetryReporterName').mockReturnValue('test-reporter-name');

      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      jest.clearAllMocks();
      jest.restoreAllMocks();
      TelemetryServiceProvider.instances.clear();
    });

    it('should return early if extensionContext is not set', async () => {
      (instance as any).extensionContext = undefined;

      await instance.refreshReporters(mockExtensionContext);

      expect(mockUserService).not.toHaveBeenCalled();
      expect(mockDetermineReporters).not.toHaveBeenCalled();
    });

    it('should return early if no reporters exist', async () => {
      (instance as any).reporters = [];

      await instance.refreshReporters(mockExtensionContext);

      expect(mockUserService).not.toHaveBeenCalled();
      expect(mockDetermineReporters).not.toHaveBeenCalled();
    });

    it('should return early if telemetry is disabled', async () => {
      spyIsTelemetryEnabled.mockResolvedValue(false);

      await instance.refreshReporters(mockExtensionContext);

      expect(mockUserService).not.toHaveBeenCalled();
      expect(mockDetermineReporters).not.toHaveBeenCalled();
    });

    it('should successfully refresh reporters with updated user ID', async () => {
      const newReporter1 = { dispose: jest.fn(), sendTelemetryEvent: jest.fn(), sendExceptionEvent: jest.fn() } as any;
      const newReporter2 = { dispose: jest.fn(), sendTelemetryEvent: jest.fn(), sendExceptionEvent: jest.fn() } as any;
      mockDetermineReporters.mockReturnValue([newReporter1, newReporter2]);

      await instance.refreshReporters(mockExtensionContext);

      // Verify old reporters were disposed
      expect(mockReporter1.dispose).toHaveBeenCalled();
      expect(mockReporter2.dispose).toHaveBeenCalled();

      // Verify user ID was fetched with the correct parameters
      // Since this is not the Core extension (no extension.id), it should get a DefaultSharedTelemetryProvider
      expect(mockUserService).toHaveBeenCalledWith(
        mockExtensionContext,
        expect.objectContaining({
          getSharedTelemetryUserId: expect.any(Function)
        })
      );

      // Verify new reporters were created with correct config
      expect(mockDetermineReporters).toHaveBeenCalledWith({
        extName: 'test-extension',
        version: '1.0.0',
        aiKey: 'test-ai-key',
        userId: 'updated-user-id',
        reporterName: 'test-reporter-name',
        isDevMode: false
      });

      // Verify new reporters were added
      expect((instance as any).reporters).toEqual([newReporter1, newReporter2]);

      // Verify reporters were added to subscriptions
      expect(mockExtensionContext.subscriptions).toContain(newReporter1);
      expect(mockExtensionContext.subscriptions).toContain(newReporter2);

      // Verify console log
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Telemetry reporters refreshed for test-extension with new user ID:',
        'updated-user-id'
      );
    });

    it('should handle reporter disposal errors gracefully', async () => {
      const disposalError = new Error('Disposal failed');
      mockReporter1.dispose.mockRejectedValue(disposalError);

      // Should not throw despite disposal error
      await expect(instance.refreshReporters(mockExtensionContext)).resolves.not.toThrow();

      // Should still proceed with creating new reporters
      expect(mockDetermineReporters).toHaveBeenCalled();
      expect(mockUserService).toHaveBeenCalled();
    });

    it('should clear reporters array before adding new ones', async () => {
      const initialReportersLength = (instance as any).reporters.length;
      expect(initialReportersLength).toBeGreaterThan(0);

      const newReporter = { dispose: jest.fn(), sendTelemetryEvent: jest.fn(), sendExceptionEvent: jest.fn() } as any;
      mockDetermineReporters.mockReturnValue([newReporter]);

      await instance.refreshReporters(mockExtensionContext);

      // Should have exactly the new reporters, not appended to old ones
      expect((instance as any).reporters).toEqual([newReporter]);
      expect((instance as any).reporters.length).toBe(1);
    });

    it('should use dev mode setting from instance', async () => {
      (instance as any).isDevMode = true;

      await instance.refreshReporters(mockExtensionContext);

      expect(mockDetermineReporters).toHaveBeenCalledWith(
        expect.objectContaining({
          isDevMode: true
        })
      );
    });

    it('should throw when trying to add reporters to undefined subscriptions', async () => {
      mockExtensionContext.subscriptions = undefined;

      // Should throw when trying to push to undefined subscriptions
      await expect(instance.refreshReporters(mockExtensionContext)).rejects.toThrow();

      // Should have attempted to create reporters
      expect(mockDetermineReporters).toHaveBeenCalled();
    });

    describe('O11y Reporter Initialization', () => {
      it('should initialize O11y reporter when enabled with boolean true', async () => {
        mockExtensionContext.extension.packageJSON.enableO11y = 'true';

        await instance.refreshReporters(mockExtensionContext);

        expect(mockInitializeO11yReporter).toHaveBeenCalledWith(
          'test-extension',
          'https://test-endpoint.com',
          'updated-user-id',
          '1.0.0'
        );
      });

      it('should not initialize O11y reporter when disabled with boolean false', async () => {
        mockExtensionContext.extension.packageJSON.enableO11y = 'false';

        await instance.refreshReporters(mockExtensionContext);

        expect(mockInitializeO11yReporter).not.toHaveBeenCalled();
      });

      it('should not initialize O11y reporter when no upload endpoint is provided', async () => {
        mockExtensionContext.extension.packageJSON.o11yUploadEndpoint = undefined;

        await instance.refreshReporters(mockExtensionContext);

        expect(mockInitializeO11yReporter).not.toHaveBeenCalled();
      });

      it('should work with undefined enableO11y field', async () => {
        mockExtensionContext.extension.packageJSON.enableO11y = undefined;

        await instance.refreshReporters(mockExtensionContext);

        // Should not initialize O11y reporter when enableO11y is undefined
        expect(mockInitializeO11yReporter).not.toHaveBeenCalled();

        // Should still create regular reporters
        expect(mockDetermineReporters).toHaveBeenCalled();
      });

      it('should work with empty string enableO11y field', async () => {
        mockExtensionContext.extension.packageJSON.enableO11y = '';

        await instance.refreshReporters(mockExtensionContext);

        // Should not initialize O11y reporter when enableO11y is empty string
        expect(mockInitializeO11yReporter).not.toHaveBeenCalled();

        // Should still create regular reporters
        expect(mockDetermineReporters).toHaveBeenCalled();
      });

      it('should handle case-insensitive enableO11y values', async () => {
        mockExtensionContext.extension.packageJSON.enableO11y = 'TRUE';

        await instance.refreshReporters(mockExtensionContext);

        // Should initialize O11y reporter when enableO11y is 'TRUE' (case insensitive)
        expect(mockInitializeO11yReporter).toHaveBeenCalledWith(
          'test-extension',
          'https://test-endpoint.com',
          'updated-user-id',
          '1.0.0'
        );
      });

      it('should handle O11y initialization errors by throwing', async () => {
        const o11yError = new Error('O11y initialization failed');
        mockInitializeO11yReporter.mockRejectedValue(o11yError);

        // Should throw when O11y initialization fails
        await expect(instance.refreshReporters(mockExtensionContext)).rejects.toThrow('O11y initialization failed');

        // Should have attempted to initialize O11y
        expect(mockInitializeO11yReporter).toHaveBeenCalled();
      });
    });

    describe('Provider Selection', () => {
      it('should pass DefaultSharedTelemetryProvider for non-Core extensions', async () => {
        // Mock extension context for non-Core extension (no extension.id)
        const nonCoreContext = {
          extension: {
            packageJSON: {
              name: 'test-extension',
              version: '1.0.0'
            }
            // No id field = not Core extension
          },
          subscriptions: []
        };

        (instance as any).extensionContext = nonCoreContext;
        (instance as any).reporters = [mockReporter1];

        await instance.refreshReporters(nonCoreContext as any);

        // Should pass a DefaultSharedTelemetryProvider
        expect(mockUserService).toHaveBeenCalledWith(
          nonCoreContext,
          expect.objectContaining({
            getSharedTelemetryUserId: expect.any(Function)
          })
        );
      });

      it('should pass undefined provider for Core extension', async () => {
        // Mock extension context for Core extension
        const coreContext = {
          extension: {
            id: 'salesforce.salesforcedx-vscode-core',
            packageJSON: {
              name: 'salesforcedx-vscode-core',
              version: '1.0.0'
            }
          },
          subscriptions: []
        };

        (instance as any).extensionContext = coreContext;
        (instance as any).reporters = [mockReporter1];

        await instance.refreshReporters(coreContext as any);

        // Should pass undefined to avoid infinite loop
        expect(mockUserService).toHaveBeenCalledWith(coreContext, undefined);
      });
    });

    describe('Error Handling', () => {
      it('should handle invalid package.json schema gracefully', async () => {
        mockExtensionContext.extension.packageJSON = {
          // Missing required name and version fields
          enableO11y: 'true'
        };

        // Should throw due to Zod validation error
        await expect(instance.refreshReporters(mockExtensionContext)).rejects.toThrow();

        // Should not have proceeded to create reporters
        expect(mockDetermineReporters).not.toHaveBeenCalled();
      });

      it('should handle getTelemetryUserId errors', async () => {
        const userServiceError = new Error('Failed to get user ID');
        mockUserService.mockRejectedValue(userServiceError);

        // Should throw when user service fails
        await expect(instance.refreshReporters(mockExtensionContext)).rejects.toThrow('Failed to get user ID');

        // Should have attempted to get user ID with the correct parameters
        // Since this is not the Core extension (no extension.id), it should get a DefaultSharedTelemetryProvider
        expect(mockUserService).toHaveBeenCalledWith(
          mockExtensionContext,
          expect.objectContaining({
            getSharedTelemetryUserId: expect.any(Function)
          })
        );
      });

      it('should handle missing package.json fields gracefully', async () => {
        mockExtensionContext.extension.packageJSON = {
          name: 'test-extension',
          version: '1.0.0'
          // Missing o11yUploadEndpoint and enableO11y
        };

        await expect(instance.refreshReporters(mockExtensionContext)).resolves.not.toThrow();

        expect(mockDetermineReporters).toHaveBeenCalledWith({
          extName: 'test-extension',
          version: '1.0.0',
          aiKey: 'test-ai-key',
          userId: 'updated-user-id',
          reporterName: 'test-reporter-name',
          isDevMode: false
        });

        // Should not initialize O11y reporter when fields are missing
        expect(mockInitializeO11yReporter).not.toHaveBeenCalled();
      });
    });
  });
});
