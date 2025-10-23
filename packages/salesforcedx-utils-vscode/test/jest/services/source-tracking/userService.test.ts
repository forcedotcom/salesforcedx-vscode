/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionContext } from 'vscode';
import {
  CliCommandExecution,
  CliCommandExecutor,
  TelemetryService,
  WorkspaceContextUtil,
  workspaceUtils
} from '../../../../src';
import { UNAUTHENTICATED_USER } from '../../../../src/constants';
import {
  UserService,
  getWebTelemetryUserId,
  DefaultSharedTelemetryProvider
} from '../../../../src/services/userService';

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
    let getRootWorkspacePathSpy: jest.SpyInstance;

    beforeEach(() => {
      const stdoutSubject = {
        subscribe: (callback: any) => callback(Buffer.from(JSON.stringify(fakeCliTelemetryData)))
      };
      const stderrSubject = {
        subscribe: (callback: any) => callback(Buffer.from(''))
      };
      const processExitSubject = {
        subscribe: (callback: any) => callback(0)
      };

      cliCommandExecution = {
        stdoutSubject,
        stderrSubject,
        processExitSubject,
        processExitCode: Promise.resolve(0),
        processError: Promise.resolve(undefined),
        processStdout: Promise.resolve(''),
        processStderr: Promise.resolve('')
      } as unknown as CliCommandExecution;
      getRootWorkspacePathSpy = jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue('abc');
      executionSpy = jest.spyOn(CliCommandExecutor.prototype, 'execute').mockReturnValue(cliCommandExecution);
    });

    it('should return command output of sf telemetry', async () => {
      const fakePath = '/fine/total';

      getRootWorkspacePathSpy.mockReturnValueOnce(fakePath);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await (UserService as any).executeCliTelemetry();

      expect(getRootWorkspacePathSpy).toHaveBeenCalled();
      expect(executionSpy).toHaveBeenCalled();
      expect(result).toBe(JSON.stringify(fakeCliTelemetryData));
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

    let telemetryService: TelemetryService;
    let fakeExtensionContext: ExtensionContext;

    let executeCliTelemetrySpy: jest.SpyInstance;
    let getRandomUserIdSpy: jest.SpyInstance;
    let fakeGet: jest.SpyInstance;
    let fakeUpdate: jest.SpyInstance;

    beforeEach(() => {
      telemetryService = new TelemetryService();
      fakeGet = jest.fn();
      fakeUpdate = jest.fn();
      (telemetryService as any).extensionContext = { globalState: { get: fakeGet, update: fakeUpdate } };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      fakeExtensionContext = (telemetryService as any).extensionContext;
      executeCliTelemetrySpy = jest.spyOn(UserService as any, 'executeCliTelemetry');
      getRandomUserIdSpy = jest.spyOn(UserService as any, 'getRandomUserId');
    });

    it('should return cliId when telemetryUserId is undefined in global state', async () => {
      fakeGet.mockReturnValueOnce(undefined);
      fakeUpdate.mockResolvedValueOnce(undefined);
      executeCliTelemetrySpy.mockResolvedValueOnce(JSON.stringify(fakeCliTelemetryData));

      const uId = await UserService.getTelemetryUserId(fakeExtensionContext);

      expect(uId).toBe(fakeCliTelemetryData.result.cliId);
      expect(executeCliTelemetrySpy).toHaveBeenCalled();
    });

    it('should generate random userId when telemetryUserId as well as cliId is undefined', async () => {
      fakeGet.mockReturnValueOnce(undefined);
      executeCliTelemetrySpy.mockResolvedValueOnce(JSON.stringify(fakeCliIdUndefined));
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

describe('getWebTelemetryUserId', () => {
  let fakeExtensionContext: ExtensionContext;
  let workspaceContextSpy: jest.SpyInstance;
  let mockSharedTelemetryProvider: DefaultSharedTelemetryProvider;

  beforeEach(() => {
    fakeExtensionContext = {
      globalState: { get: jest.fn(), update: jest.fn() }
    } as unknown as ExtensionContext;

    workspaceContextSpy = jest.spyOn(WorkspaceContextUtil, 'getInstance').mockReturnValue({
      orgId: undefined,
      username: undefined
    } as any);

    mockSharedTelemetryProvider = {
      getSharedTelemetryUserId: jest.fn().mockResolvedValue(undefined)
    } as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return shared telemetry user ID when available from provider', async () => {
    const sharedUserId = 'shared-user-id-123';
    mockSharedTelemetryProvider.getSharedTelemetryUserId = jest.fn().mockResolvedValue(sharedUserId);

    const result = await getWebTelemetryUserId(fakeExtensionContext, mockSharedTelemetryProvider);

    expect(result).toBe(sharedUserId);
    expect(mockSharedTelemetryProvider.getSharedTelemetryUserId).toHaveBeenCalled();
  });

  it('should return hashed user ID when org data is available', async () => {
    const orgId = 'test-org-id';
    const username = 'test-user@example.com';

    workspaceContextSpy.mockReturnValue({
      orgId,
      username
    });

    const result = await getWebTelemetryUserId(fakeExtensionContext, mockSharedTelemetryProvider);

    expect(result).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash format
  });

  it('should return UNAUTHENTICATED_USER when no org data is available', async () => {
    workspaceContextSpy.mockReturnValue({
      orgId: undefined,
      username: undefined
    });

    const result = await getWebTelemetryUserId(fakeExtensionContext, mockSharedTelemetryProvider);

    expect(result).toBe(UNAUTHENTICATED_USER);
  });
});
