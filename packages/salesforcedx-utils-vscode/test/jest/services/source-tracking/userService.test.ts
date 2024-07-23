/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionContext } from 'vscode';
import { CliCommandExecution, CliCommandExecutor, CommandOutput, SfCommandBuilder, TelemetryService, workspaceUtils } from '../../../../src';
import { UserService } from '../../../../src/services/userService';

describe('UserService', () => {
  const fakeCliTelemetryData = {
    result: {
      enabled: true,
      cliId: 'fakecliid234drrf5'
    }
  };

  describe('executeCliTelemetry', () => {
    let cliCommandExecution: CliCommandExecution;
    let executionSpy: jest.SpyInstance;
    let getCmdResultSpy: jest.SpyInstance;
    let getRootWorkspacePathSpy: jest.SpyInstance;

    beforeEach(() => {
      getRootWorkspacePathSpy = jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue('abc');
      executionSpy = jest.spyOn(CliCommandExecutor.prototype, 'execute').mockReturnValue(cliCommandExecution);
      getCmdResultSpy = jest.spyOn(CommandOutput.prototype, 'getCmdResult').mockResolvedValue(JSON.stringify(fakeCliTelemetryData));
    });
    it('should return command output of sf telemetry', async () => {
      const fakePath = '/fine/total';
      // const fakeCommand = 'sf telemetry --json';
      const fakeExecution = 'FindCliIdValue';

      getRootWorkspacePathSpy.mockReturnValueOnce(fakePath);
      executionSpy.mockReturnValueOnce(fakeExecution);
      getCmdResultSpy.mockResolvedValueOnce(fakeCliTelemetryData);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await (UserService as any).executeCliTelemetry();

      expect(getRootWorkspacePathSpy).toHaveBeenCalled();
      expect(executionSpy).toHaveBeenCalled();
      expect(getCmdResultSpy).toHaveBeenCalled();
      expect(result).toBe(fakeCliTelemetryData);
    });
  });
  describe('getTelemetryUserId', () => {
    const fakeCliIdUndefined = {
      result: {
        enabled: true
      }
    };
    const randomId = 'setredfvvvgbbdtrfyv234dd';
    const globalTelemetryUserId = 'e45rdcfy7ygvhu8uhbnjiiugdrgb';
    const fakeTelemetryCommand = 'sf telemetry --json';

    let telemetryService: TelemetryService;
    let fakeExtensionContext: ExtensionContext;

    let executeCliTelemetrySpy: jest.SpyInstance;
    let getRandomUserIdSpy: jest.SpyInstance;
    let buildCliTelemetryCommandSpy: jest.SpyInstance;
    let fakeGet: jest.SpyInstance;
    let fakeUpdate: jest.SpyInstance;

    beforeEach(() => {
      telemetryService = new TelemetryService();
      fakeGet = jest.fn();
      fakeUpdate = jest.fn();
      (telemetryService as any).extensionContext = { globalState: { get: fakeGet, update: fakeUpdate } };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      fakeExtensionContext = (telemetryService as any).extensionContext;
      executeCliTelemetrySpy = jest.spyOn((UserService as any), 'executeCliTelemetry');
      getRandomUserIdSpy = jest.spyOn((UserService as any), 'getRandomUserId');
      buildCliTelemetryCommandSpy = jest.spyOn((UserService as any), 'buildCliTelemetryCommand');

    });

    it('should return cliId when telemetryUserId is undefined in global state', async () => {
      fakeGet.mockReturnValueOnce(undefined);
      fakeUpdate.mockResolvedValueOnce(undefined);
      buildCliTelemetryCommandSpy.mockReturnValueOnce(fakeTelemetryCommand);
      executeCliTelemetrySpy.mockResolvedValueOnce(JSON.stringify(fakeCliTelemetryData));

      const uId = await UserService.getTelemetryUserId(fakeExtensionContext);

      expect(uId).toBe(fakeCliTelemetryData.result.cliId);
      expect(executeCliTelemetrySpy).toHaveBeenCalled();
    });

    it('should generate random userId when telemetryUserId as well as cliId is undefined', async () => {
      fakeGet.mockReturnValueOnce(undefined);
      executeCliTelemetrySpy.mockResolvedValueOnce(JSON.stringify(fakeCliIdUndefined));
      buildCliTelemetryCommandSpy.mockReturnValueOnce(fakeTelemetryCommand);
      getRandomUserIdSpy.mockResolvedValueOnce(randomId);

      const uId = await UserService.getTelemetryUserId(fakeExtensionContext);

      expect(getRandomUserIdSpy).toHaveBeenCalled();
      expect(uId).toBe(randomId);
    });

    it('should return telemetryUserId when defined in globalState', async () => {
      fakeGet.mockReturnValueOnce(globalTelemetryUserId);

      const uId = await UserService.getTelemetryUserId(fakeExtensionContext);

      expect(executeCliTelemetrySpy).not.toHaveBeenCalled();
      expect(getRandomUserIdSpy).not.toHaveBeenCalled();
      expect(uId).not.toBe(randomId);
      expect(uId).toBe(globalTelemetryUserId);
    });
  });
});
