/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Config, OrgConfigProperties } from '@salesforce/core';
import { ConfigAggregator } from '@salesforce/core/configAggregator';
import * as Effect from 'effect/Effect';
import { ConfigService, ConfigWriteError } from '../../../src/core/configService';

jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  Config: { create: jest.fn(), getDefaultOptions: jest.fn().mockReturnValue({}) }
}));

jest.mock('@salesforce/core/configAggregator', () => ({
  ConfigAggregator: { create: jest.fn() }
}));

const vscode = require('vscode');

const setMock = jest.fn();
const writeMock = jest.fn();
const createMock = jest.mocked(Config.create);
const aggregatorCreateMock = jest.mocked(ConfigAggregator.create);

describe('ConfigService.setTargetOrg', () => {
  beforeEach(() => {
    setMock.mockReset();
    writeMock.mockReset().mockResolvedValue(undefined);
    createMock.mockReset().mockResolvedValue({ set: setMock, write: writeMock } as unknown as Config);
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

const TARGET_ORG_KEY: string = OrgConfigProperties.TARGET_ORG;

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
