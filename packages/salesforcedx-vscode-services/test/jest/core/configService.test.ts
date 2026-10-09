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

const openMockWorkspace = (): void => {
  vscode.workspace.workspaceFolders = [
    {
      uri: { scheme: 'file', fsPath: MOCK_WORKSPACE_PATH, toString: (): string => `file://${MOCK_WORKSPACE_PATH}` },
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
  { method: 'setTargetOrg', write: () => ConfigService.setTargetOrg('MyAlias') },
  { method: 'unsetTargetOrg', write: () => ConfigService.unsetTargetOrg() },
  { method: 'unsetTargetDevHub', write: () => ConfigService.unsetTargetDevHub() }
])('ConfigService.$method project root', ({ write }) => {
  beforeEach(() => {
    resetConfigMocks();
    openMockWorkspace();
  });

  it('creates the local config at the workspace root, not process.cwd()', async () => {
    await Effect.runPromise(write().pipe(Effect.provide(ConfigService.Default)));

    // bare root: Config appends .sf/config.json itself
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ rootFolder: MOCK_WORKSPACE_PATH }));
  });

  it('fails with NoWorkspaceOpenError and never creates a config when no workspace is open', async () => {
    vscode.workspace.workspaceFolders = [];

    const error = await Effect.runPromise(write().pipe(Effect.provide(ConfigService.Default), Effect.flip));

    expect(error).toBeInstanceOf(NoWorkspaceOpenError);
    expect(createMock).not.toHaveBeenCalled();
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
