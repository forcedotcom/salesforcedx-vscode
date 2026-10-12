/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Config, OrgConfigProperties, SfConfigProperties } from '@salesforce/core';
import { ConfigAggregator } from '@salesforce/core/configAggregator';
import * as Effect from 'effect/Effect';
import { ConfigService, ConfigWriteError } from '../../../src/core/configService';
import { NoWorkspaceOpenError } from '../../../src/vscode/workspaceService';

jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  Config: { create: jest.fn(), getDefaultOptions: jest.fn().mockReturnValue({}) }
}));

jest.mock('@salesforce/core/configAggregator', () => ({
  ConfigAggregator: { create: jest.fn() }
}));

const vscode = require('vscode');

const setMock = jest.fn();
const unsetMock = jest.fn();
const writeMock = jest.fn();
const createMock = jest.mocked(Config.create);
const aggregatorCreateMock = jest.mocked(ConfigAggregator.create);

const MOCK_WORKSPACE_PATH = '/mock/workspace';

const openMockWorkspace = (
  scheme = 'file',
  fsPath = MOCK_WORKSPACE_PATH,
  uriString = `file://${MOCK_WORKSPACE_PATH}`
): void => {
  vscode.workspace.workspaceFolders = [
    {
      uri: { scheme, fsPath, toString: (): string => uriString },
      name: 'mock-workspace',
      index: 0
    }
  ];
};

const resetConfigMocks = (): void => {
  setMock.mockReset();
  unsetMock.mockReset();
  writeMock.mockReset().mockResolvedValue(undefined);
  createMock.mockReset().mockResolvedValue({ set: setMock, unset: unsetMock, write: writeMock } as unknown as Config);
};

describe('ConfigService.setTargetOrg', () => {
  beforeEach(() => {
    resetConfigMocks();
    openMockWorkspace();
  });

  it('writes the alias to target-org config', async () => {
    const calls: string[] = [];
    setMock.mockImplementation(() => calls.push('set'));
    writeMock.mockImplementation(() => {
      calls.push('write');
      return Promise.resolve();
    });

    await Effect.runPromise(ConfigService.setTargetOrg('MyAlias').pipe(Effect.provide(ConfigService.Default)));

    // set called with TARGET_ORG + the provided alias
    expect(setMock).toHaveBeenCalledWith(OrgConfigProperties.TARGET_ORG, 'MyAlias');
    // write called after set (write-before-reload ordering)
    expect(calls).toEqual(['set', 'write']);
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it('wraps a write failure in ConfigWriteError', async () => {
    writeMock.mockRejectedValueOnce(new Error('disk full'));

    const error = await Effect.runPromise(
      ConfigService.setTargetOrg('MyAlias').pipe(Effect.provide(ConfigService.Default), Effect.flip)
    );

    expect(error).toBeInstanceOf(ConfigWriteError);
    expect(error.message).toContain('disk full');
  });
});

// process.cwd() is the VS Code install folder when launched from the Windows Start menu (#8301),
// so every local-config write must root at the workspace like getConfigAggregator does
describe.each([
  {
    method: 'setTargetOrg',
    write: () => ConfigService.setTargetOrg('MyAlias'),
    mutation: setMock,
    args: [OrgConfigProperties.TARGET_ORG, 'MyAlias']
  },
  {
    method: 'unsetTargetOrg',
    write: () => ConfigService.unsetTargetOrg(),
    mutation: unsetMock,
    args: [OrgConfigProperties.TARGET_ORG]
  },
  {
    method: 'unsetTargetDevHub',
    write: () => ConfigService.unsetTargetDevHub(),
    mutation: unsetMock,
    args: [OrgConfigProperties.TARGET_DEV_HUB]
  }
])('ConfigService.$method project root', ({ write, mutation, args }) => {
  beforeEach(() => {
    resetConfigMocks();
    openMockWorkspace();
  });

  it('creates the local config at the workspace root, not process.cwd()', async () => {
    await Effect.runPromise(write().pipe(Effect.provide(ConfigService.Default)));

    // bare root: Config appends .sf/config.json itself
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ rootFolder: MOCK_WORKSPACE_PATH }));
    expect(mutation).toHaveBeenCalledWith(...args);
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it('fails with NoWorkspaceOpenError and never creates a config when no workspace is open', async () => {
    vscode.workspace.workspaceFolders = [];

    const error = await Effect.runPromise(write().pipe(Effect.provide(ConfigService.Default), Effect.flip));

    expect(error).toBeInstanceOf(NoWorkspaceOpenError);
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe('ConfigService workspace root path', () => {
  beforeEach(resetConfigMocks);

  it('preserves a Windows drive path from the workspace fsPath', async () => {
    openMockWorkspace('file', 'C:\\project', 'file:///C:/project');

    await Effect.runPromise(ConfigService.setTargetOrg('MyAlias').pipe(Effect.provide(ConfigService.Default)));

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ rootFolder: 'C:\\project' }));
  });

  it('preserves the leading slash of a memfs workspace fsPath', async () => {
    openMockWorkspace('memfs', '/project', 'memfs:/project');

    await Effect.runPromise(ConfigService.setTargetOrg('MyAlias').pipe(Effect.provide(ConfigService.Default)));

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ rootFolder: '/project' }));
  });

  it('normalizes Windows separators in a memfs workspace fsPath', async () => {
    openMockWorkspace('memfs', '\\project', 'memfs:/project');

    await Effect.runPromise(ConfigService.setTargetOrg('MyAlias').pipe(Effect.provide(ConfigService.Default)));

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ rootFolder: '/project' }));
  });
});

describe.each([
  { method: 'unsetTargetOrg', write: () => ConfigService.unsetTargetOrg() },
  { method: 'unsetTargetDevHub', write: () => ConfigService.unsetTargetDevHub() }
])('ConfigService.$method errors', ({ write }) => {
  beforeEach(() => {
    resetConfigMocks();
    openMockWorkspace();
  });

  it('wraps config creation failures in ConfigWriteError', async () => {
    createMock.mockRejectedValueOnce(new Error('config unavailable'));

    const error = await Effect.runPromise(write().pipe(Effect.provide(ConfigService.Default), Effect.flip));

    expect(error).toBeInstanceOf(ConfigWriteError);
    expect(error.message).toContain('config unavailable');
  });

  it('wraps config write failures in ConfigWriteError', async () => {
    writeMock.mockRejectedValueOnce(new Error('disk full'));

    const error = await Effect.runPromise(write().pipe(Effect.provide(ConfigService.Default), Effect.flip));

    expect(error).toBeInstanceOf(ConfigWriteError);
    expect(error.message).toContain('disk full');
  });
});

const TARGET_ORG_KEY: string = OrgConfigProperties.TARGET_ORG;
const TARGET_DEV_HUB_KEY: string = OrgConfigProperties.TARGET_DEV_HUB;

describe('ConfigService.getTargetOrg', () => {
  const getPropertyValueMock = jest.fn();

  beforeEach(() => {
    getPropertyValueMock.mockReset();
    const agg = {
      getPropertyValue: getPropertyValueMock,
      getConfig: () => ({}),
      reload: () => Promise.resolve(agg)
    } as unknown as ConfigAggregator;
    aggregatorCreateMock.mockReset().mockResolvedValue(agg);
    vscode.workspace.workspaceFolders = [
      {
        uri: { scheme: 'file', fsPath: '/mock/workspace', toString: (): string => 'file:///mock/workspace' },
        name: 'mock-workspace',
        index: 0
      }
    ];
  });

  it('returns the configured target-org value', async () => {
    getPropertyValueMock.mockImplementation((prop: string) => (prop === TARGET_ORG_KEY ? 'MyOrg' : undefined));

    const value = await Effect.runPromise(ConfigService.getTargetOrg().pipe(Effect.provide(ConfigService.Default)));

    expect(value).toBe('MyOrg');
  });

  it('returns undefined when target-org is not set', async () => {
    getPropertyValueMock.mockReturnValue(undefined);

    const value = await Effect.runPromise(ConfigService.getTargetOrg().pipe(Effect.provide(ConfigService.Default)));

    expect(value).toBeUndefined();
  });
});

describe('ConfigService.getTargetDevHub', () => {
  const getPropertyValueMock = jest.fn();

  beforeEach(() => {
    getPropertyValueMock.mockReset();
    const agg = {
      getPropertyValue: getPropertyValueMock,
      getConfig: () => ({}),
      reload: () => Promise.resolve(agg)
    } as unknown as ConfigAggregator;
    aggregatorCreateMock.mockReset().mockResolvedValue(agg);
    vscode.workspace.workspaceFolders = [
      {
        uri: { scheme: 'file', fsPath: '/mock/workspace', toString: (): string => 'file:///mock/workspace' },
        name: 'mock-workspace',
        index: 0
      }
    ];
  });

  it('returns the configured target-dev-hub value', async () => {
    getPropertyValueMock.mockImplementation((prop: string) => (prop === TARGET_DEV_HUB_KEY ? 'MyHub' : undefined));

    const value = await Effect.runPromise(ConfigService.getTargetDevHub().pipe(Effect.provide(ConfigService.Default)));

    expect(value).toBe('MyHub');
  });

  it('returns undefined when target-dev-hub is not set', async () => {
    getPropertyValueMock.mockReturnValue(undefined);

    const value = await Effect.runPromise(ConfigService.getTargetDevHub().pipe(Effect.provide(ConfigService.Default)));

    expect(value).toBeUndefined();
  });
});

const DISABLE_TELEMETRY_KEY: string = SfConfigProperties.DISABLE_TELEMETRY;

describe('ConfigService.isCliTelemetryDisabled', () => {
  const getPropertyValueMock = jest.fn();

  beforeEach(() => {
    getPropertyValueMock.mockReset();
    const agg = {
      getPropertyValue: getPropertyValueMock,
      getConfig: () => ({}),
      reload: () => Promise.resolve(agg)
    } as unknown as ConfigAggregator;
    aggregatorCreateMock.mockReset().mockResolvedValue(agg);
    vscode.workspace.workspaceFolders = [
      {
        uri: { scheme: 'file', fsPath: '/mock/workspace', toString: (): string => 'file:///mock/workspace' },
        name: 'mock-workspace',
        index: 0
      }
    ];
  });

  it('treats the string "true" as disabled', async () => {
    getPropertyValueMock.mockImplementation((prop: string) => (prop === DISABLE_TELEMETRY_KEY ? 'true' : undefined));

    const disabled = await Effect.runPromise(
      ConfigService.isCliTelemetryDisabled().pipe(Effect.provide(ConfigService.Default))
    );

    expect(disabled).toBe(true);
  });

  it('treats a boolean true as disabled', async () => {
    getPropertyValueMock.mockImplementation((prop: string) => (prop === DISABLE_TELEMETRY_KEY ? true : undefined));

    const disabled = await Effect.runPromise(
      ConfigService.isCliTelemetryDisabled().pipe(Effect.provide(ConfigService.Default))
    );

    expect(disabled).toBe(true);
  });

  it('returns false when disable-telemetry is unset', async () => {
    getPropertyValueMock.mockReturnValue(undefined);

    const disabled = await Effect.runPromise(
      ConfigService.isCliTelemetryDisabled().pipe(Effect.provide(ConfigService.Default))
    );

    expect(disabled).toBe(false);
  });
});
