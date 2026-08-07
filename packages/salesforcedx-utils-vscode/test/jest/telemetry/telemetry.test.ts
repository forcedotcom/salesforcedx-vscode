/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { TelemetryServiceInterface } from '@salesforce/vscode-service-provider';
import * as Effect from 'effect/Effect';
import * as Queue from 'effect/Queue';
import * as Stream from 'effect/Stream';
import { makeGovernedEgressDispatcher } from 'salesforcedx-vscode-services/out/src/observability/governedEgressDispatcher';
import { ExtensionContext, extensions, workspace } from 'vscode';
import { SFDX_CORE_EXTENSION_NAME } from '../../../src/constants';
import { TelemetryService, TelemetryServiceProvider } from '../../../src/services/telemetry';
import type { GovernedEgressSink } from '../../../src/telemetry/governedTelemetry';
import { AppInsights } from '../../../src/telemetry/reporters/appInsights';
import { LogStream } from '../../../src/telemetry/reporters/logStream';
import { O11yReporter } from '../../../src/telemetry/reporters/o11yReporter';
import { TelemetryFile } from '../../../src/telemetry/reporters/telemetryFile';

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

      jest.spyOn(extensions, 'getExtension').mockReturnValue({
        isActive: true,
        exports: {
          services: {
            TelemetryIdentitySnapshot: () => ({ cliId: 'cli', webUserId: 'web' })
          }
        }
      } as any);

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
        const hrtime: [number, number] = [Math.floor(fiftyMsAgo / 1000), (fiftyMsAgo % 1000) * 1_000_000];

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
        const hrtime: [number, number] = [Math.floor(fiftyMsAgo / 1000), (fiftyMsAgo % 1000) * 1_000_000];

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
          // No measurements object at all when startTime is undefined and none were passed
          undefined
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

    describe('updateReporters caches org identity', () => {
      const orgIdentity = {
        orgId: '00Dxx',
        orgShape: 'Scratch' as const,
        devHubId: '00Dhub',
        orgEdition: 'Developer Edition'
      };
      // Object.create(prototype) so `instanceof` matches without running heavy constructors.
      const appInsights = Object.assign(Object.create(AppInsights.prototype), { userId: '', webUserId: '' });
      const o11y = Object.assign(Object.create(O11yReporter.prototype), { userId: '', webUserId: '' });
      const telemetryFile = Object.create(TelemetryFile.prototype);
      const logStream = Object.create(LogStream.prototype);
      const extensionContext = {
        extension: { packageJSON: { name: 'salesforcedx-vscode-core', version: '1.0.0' } }
      } as unknown as ExtensionContext;

      beforeEach(() => {
        (instance as any).reporters = [appInsights, o11y, telemetryFile, logStream];
        (instance as any).extensionContext = extensionContext;
        jest.spyOn(instance, 'isTelemetryEnabled').mockResolvedValue(true);
        jest.spyOn(instance, 'getIdentityFromServices').mockResolvedValue({
          cliId: 'cli',
          webUserId: 'sha',
          ...orgIdentity
        });
      });

      it('sets orgIdentity on every reporter class', async () => {
        await instance.updateReporters(extensionContext);

        expect(appInsights.orgIdentity).toEqual(orgIdentity);
        expect(o11y.orgIdentity).toEqual(orgIdentity);
        expect(telemetryFile.orgIdentity).toEqual(orgIdentity);
        expect(logStream.orgIdentity).toEqual(orgIdentity);
      });
    });

    describe('governed production telemetry boundary', () => {
      const snapshot = jest.fn();

      beforeEach(() => {
        jest.spyOn(extensions, 'getExtension').mockReturnValue({
          isActive: true,
          exports: { services: { TelemetryIdentitySnapshot: snapshot } }
        } as any);
        snapshot.mockReturnValue({
          cliId: 'cli',
          webUserId: 'web',
          orgId: '00D',
          isScratch: true,
          devHubOrgId: '00Dhub',
          orgEdition: 'Developer Edition'
        });
        jest.spyOn(instance, 'getIdentityFromServices').mockResolvedValue({
          cliId: 'cli',
          webUserId: 'web',
          orgId: '00D',
          orgShape: 'Scratch',
          devHubId: '00Dhub',
          orgEdition: 'Developer Edition'
        });
      });

      it('dispatches production telemetry when a local reporter throws', async () => {
        mockReporter.sendTelemetryEvent.mockImplementation(() => {
          throw new Error('local failure');
        });
        const submit = jest.fn((_item: unknown) => Effect.succeed('claimed' as const));
        (instance as any).productionDispatcher = {
          submit,
          getCurrentOrgId: Effect.succeed('00D'),
          forceFlush: Effect.void,
          close: Effect.void
        };

        instance.sendEventData('event');
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(submit).toHaveBeenCalledTimes(1);
      });

      it('captures a complete immutable envelope identity at send time', async () => {
        const submit = jest.fn((_item: unknown) => Effect.succeed('claimed' as const));
        (instance as any).productionDispatcher = {
          submit,
          getCurrentOrgId: Effect.succeed('00D'),
          forceFlush: Effect.void,
          close: Effect.void
        };
        const properties = { key: 'before' };

        instance.sendEventData('event', properties);
        properties.key = 'after';
        snapshot.mockReturnValue({ orgId: 'later', cliId: 'later-cli', webUserId: 'later-web' });
        await new Promise(resolve => setTimeout(resolve, 0));

        const item = submit.mock.calls[0]?.[0] as any;
        expect(item.payload.identity).toEqual({
          cliId: 'cli',
          webUserId: 'web',
          orgId: '00D',
          orgShape: 'Scratch',
          devHubId: '00Dhub',
          orgEdition: 'Developer Edition'
        });
        expect(item.payload.properties).toEqual({ key: 'before' });
        expect(Object.isFrozen(item.payload)).toBe(true);
        expect(Object.isFrozen(item.payload.identity)).toBe(true);
        expect(Object.isFrozen(item.payload.properties)).toBe(true);
      });

      it.each([
        ['Gov to nonGov delayed enablement', 'gov', 'nonGov'],
        ['nonGov to Gov delayed enablement', 'nonGov', 'gov']
      ])('retains invocation identity during %s', async (_case, invocationOrgId, laterOrgId) => {
        const submit = jest.fn((_item: unknown) => Effect.succeed('queued' as const));
        (instance as any).productionDispatcher = {
          submit,
          getCurrentOrgId: Effect.succeed(laterOrgId),
          forceFlush: Effect.void,
          close: Effect.void
        };
        snapshot.mockReturnValue({
          cliId: `${invocationOrgId}-cli`,
          webUserId: `${invocationOrgId}-web`,
          orgId: invocationOrgId,
          isSandbox: true,
          devHubOrgId: `${invocationOrgId}-hub`,
          orgEdition: `${invocationOrgId}-edition`
        });

        instance.sendEventData('switch');
        snapshot.mockReturnValue({
          cliId: `${laterOrgId}-cli`,
          webUserId: `${laterOrgId}-web`,
          orgId: laterOrgId
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        const submitted = submit.mock.calls[0]?.[0] as any;
        expect(submitted.orgId).toBe(invocationOrgId);
        expect(submitted.payload.identity).toEqual({
          cliId: `${invocationOrgId}-cli`,
          webUserId: `${invocationOrgId}-web`,
          orgId: invocationOrgId,
          orgShape: 'Sandbox',
          devHubId: `${invocationOrgId}-hub`,
          orgEdition: `${invocationOrgId}-edition`
        });
      });

      it('drains deactivation admission before closing production telemetry', async () => {
        const order: string[] = [];
        const submit = jest.fn((_item: unknown) =>
          Effect.promise(async () => {
            await Promise.resolve();
            order.push('submit');
            return 'claimed' as const;
          })
        );
        const close = Effect.sync(() => order.push('close'));
        (instance as any).productionDispatcher = {
          submit,
          getCurrentOrgId: Effect.succeed('00D'),
          forceFlush: Effect.void,
          close
        };

        instance.sendExtensionDeactivationEvent();
        await new Promise(resolve => setTimeout(resolve, 0));
        instance.dispose();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(order).toEqual(['submit', 'close']);
      });

      it('drops an unknown queued item when telemetry is disabled before it becomes nonGov', async () => {
        const enabled = { value: true };
        jest.spyOn(instance, 'isTelemetryEnabled').mockImplementation(() => Promise.resolve(enabled.value));
        const sink = (await Effect.runPromise(
          (instance as any).makeProductionSink(
            {
              extName: 'test-extension',
              version: '1.0.0',
              aiKey: 'key',
              userId: 'cli',
              reporterName: 'test-extension',
              isDevMode: false,
              webUserId: 'web'
            },
            undefined
          )
        )) as GovernedEgressSink<any>;
        const changes = await Effect.runPromise(Queue.unbounded<{ orgId: string; classification: 'nonGov' }>());
        const dispatcher = await Effect.runPromise(
          makeGovernedEgressDispatcher(
            {
              getClassification: () => Effect.succeed('unknown' as const),
              changes: Stream.fromQueue(changes)
            },
            Effect.succeed(sink)
          )
        );
        const item = {
          orgId: '00D',
          payload: {
            kind: 'event',
            name: 'queued',
            identity: { orgId: '00D', cliId: 'cli', webUserId: 'web' }
          }
        };

        expect(await Effect.runPromise(dispatcher.submit(item))).toBe('queued');
        enabled.value = false;
        await Effect.runPromise(Queue.offer(changes, { orgId: '00D', classification: 'nonGov' }));
        await Effect.runPromise(Effect.sleep(10));
        await Effect.runPromise(dispatcher.forceFlush);

        expect((instance as any).productionReporters).toHaveLength(0);
        expect(mockReporter.sendTelemetryEvent).not.toHaveBeenCalledWith(
          'queued',
          expect.anything(),
          expect.anything()
        );
        await Effect.runPromise(dispatcher.close);
      });
    });

    describe('lifecycle', () => {
      it('registers the service once and direct disposal remains idempotent', async () => {
        const context = {
          extension: { packageJSON: { name: 'test-extension', version: '1.0.0' } },
          extensionMode: 1,
          subscriptions: []
        } as unknown as ExtensionContext;
        jest.spyOn(instance, 'isTelemetryEnabled').mockResolvedValue(false);
        jest.spyOn(instance, 'checkCliTelemetry').mockResolvedValue(false);

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
  });
});
