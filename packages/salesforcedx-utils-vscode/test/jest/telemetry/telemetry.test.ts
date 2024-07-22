/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TelemetryService } from '../../../src';
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
      expect(
        TelemetryServiceProvider.instances.has(SFDX_CORE_EXTENSION_NAME)
      ).toBeTruthy();
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
      expect(
        TelemetryServiceProvider.instances.has(extensionName)
      ).toBeTruthy();
    });

    it('getInstance should return the same TelemetryService instance for a named extension on subsequent calls', () => {
      const extensionName = 'someExtension';
      const firstInstance = TelemetryServiceProvider.getInstance(extensionName);
      const secondInstance =
        TelemetryServiceProvider.getInstance(extensionName);
      expect(secondInstance).toBe(firstInstance);
    });

    it('getInstance should return different instances for different extension names', () => {
      const firstExtensionName = 'extensionOne';
      const secondExtensionName = 'extensionTwo';
      const firstInstance =
        TelemetryServiceProvider.getInstance(firstExtensionName);
      const secondInstance =
        TelemetryServiceProvider.getInstance(secondExtensionName);
      expect(firstInstance).not.toBe(secondInstance);
    });
  });

  describe('Telemetry Service - getInstance', () => {
    it('getInstance should return the core instance if no extension name provided', () => {
      const firstInstance = TelemetryService.getInstance();
      const secondInstance = TelemetryServiceProvider.getInstance(
        SFDX_CORE_EXTENSION_NAME
      );
      expect(firstInstance).toBe(secondInstance);
    });
    it('getInstance should return the same TelemetryService instance for a named extension on subsequent calls', () => {
      const extensionName = 'someExtension';
      const firstInstance = TelemetryService.getInstance(extensionName);
      const secondInstance =
        TelemetryServiceProvider.getInstance(extensionName);
      expect(secondInstance).toBe(firstInstance);
    });
  });

  describe('getTelemetryReporterName', () => {
    let telemetryService: TelemetryService;
    beforeEach(() => {
      telemetryService = new TelemetryService();
    });

    it('should return "salesforcedx-vscode" when extensionName starts with "salesforcedx-vscode"', () => {
      telemetryService.extensionName = 'salesforcedx-vscode-core';
      const result = telemetryService.getTelemetryReporterName();
      expect(result).toBe('salesforcedx-vscode');
    });

    it('should return the actual extensionName when it does not start with "salesforcedx-vscode"', () => {
      telemetryService.extensionName = 'salesforcedx-einstein-gpt';
      const result = telemetryService.getTelemetryReporterName();
      expect(result).toBe(telemetryService.extensionName);
    });
  });

  describe('getUserId', () => {
    let telemetryService: TelemetryService;
    let executeCliTelemetrySpy: jest.SpyInstance;
    let getRandomUserIdSpy: jest.SpyInstance;
    let fakeGet: jest.SpyInstance;
    let fakeUpdate: jest.SpyInstance;

    const fakeCliTelemetryData = {
      result: {
        enabled: true,
        cliId: 'rdccvghuhbnjiokmnmklop'
      }
    };
    const fakeCliIdUndefined = {
      result: {
        enabled: true
      }
    };
    const randomId = 'sedtrfyv234dd';
    const globalTelemetryUserId = 'e45rdcfy7ygvhu8uhbnjiiugdrgb';

    beforeEach(() => {
      telemetryService = new TelemetryService();
      fakeGet = jest.fn();
      fakeUpdate = jest.fn();
      (telemetryService as any).extensionContext = { globalState: { get: fakeGet, update: fakeUpdate } };
      executeCliTelemetrySpy = jest.spyOn((telemetryService as any), 'executeCliTelemetry');
      getRandomUserIdSpy = jest.spyOn((telemetryService as any), 'getRandomUserId');
    });

    it('should return cliId when telemetryUserId is undefined in global state', async () => {
      fakeGet.mockReturnValueOnce(undefined);
      fakeUpdate.mockResolvedValueOnce(undefined);

      executeCliTelemetrySpy.mockResolvedValueOnce(JSON.stringify(fakeCliTelemetryData));

      const uId = await telemetryService.getUserId();

      expect(uId).toBe(fakeCliTelemetryData.result.cliId);
      expect(executeCliTelemetrySpy).toHaveBeenCalled();
    });

    it('should generate random userId when telemetryUserId as well as cliId is undefined', async () => {
      executeCliTelemetrySpy.mockResolvedValueOnce(JSON.stringify(fakeCliIdUndefined));
      getRandomUserIdSpy.mockResolvedValueOnce(randomId);

      const uId = await telemetryService.getUserId();

      expect(getRandomUserIdSpy).toHaveBeenCalled();
      expect(uId).toBe(randomId);
    });
   it('should generate random userId when cli command throws', async () => {
      executeCliTelemetrySpy.mockRejectedValueOnce(new Error('no cli for you'));
      getRandomUserIdSpy.mockResolvedValueOnce(randomId);

      const uId = await telemetryService.getUserId();

      expect(getRandomUserIdSpy).toHaveBeenCalled();
      expect(uId).toBe(randomId);
    });
    it('should return telemetryUserId when defined in globalState', async () => {
      fakeGet.mockReturnValueOnce(globalTelemetryUserId);

      const uId = await telemetryService.getUserId();

      expect(executeCliTelemetrySpy).not.toHaveBeenCalled();
      expect(getRandomUserIdSpy).not.toHaveBeenCalled();
      expect(uId).not.toBe(randomId);
      expect(uId).toBe(globalTelemetryUserId);
    });
  describe('executeCliTelemetry()', () => {
    const cliTelemetryData = {
      result: {
        enabled: true,
        cliId: 'aTotallyValidCli-id_forSur3'
      }
    };

    let executeSpy: jest.SpyInstance;
    let getCmdResultSpy: jest.SpyInstance;
    let getRootWorkspacePathSpy: jest.SpyInstance;

    beforeEach(() => {
      getRootWorkspacePathSpy = jest.spyOn(workspaceUtils, 'getRootWorkspacePath');
      executeSpy = jest.spyOn(CliCommandExecutor.prototype, 'execute');
      getCmdResultSpy = jest.spyOn(CommandOutput.prototype, 'getCmdResult');

    });

    it('should return cli telemetry data', async () => {
      const fakeExecution = 'FindMeSoCliIdValue';
      const fakeCommand = 'sfdx force:telemetry:status --json';
      const fakePath = '/some/path';

      getRootWorkspacePathSpy.mockReturnValueOnce(fakePath);
      executeSpy.mockReturnValueOnce(fakeExecution);
      getCmdResultSpy.mockResolvedValueOnce(cliTelemetryData);

      const telemetryService = new TelemetryService();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await (telemetryService as any).executeCliTelemetry(fakeCommand);

      expect(result).toBe(cliTelemetryData);
      expect(getRootWorkspacePathSpy).toHaveBeenCalled();
      expect(executeSpy).toHaveBeenCalled();
    });
  });
});
